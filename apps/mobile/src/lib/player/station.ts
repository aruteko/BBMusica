import { Orpheus, RepeatMode } from '@bbplayer/orpheus'

import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import useAppStore from '@/hooks/stores/useAppStore'
import {
	bvidFromUniqueKey,
	fetchPopularMusicTracks,
	fetchRecommendedTracks,
	getFrequentTracks,
	persistTracksToLocal,
	seedBvidOf,
} from '@/lib/services/recommendationService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import { addToQueue } from '@/utils/player'
import toast from '@/utils/toast'

const logger = log.extend('Player.Station')

/** 队列里在当前曲目之后剩余的曲目少于等于这个数时，自动补充推荐 */
const REFILL_THRESHOLD = 3
const INITIAL_BATCH = 25
const REFILL_BATCH = 15

/**
 * 「电台」只存在于内存中：记录由电台加入队列的曲目，以及用于推荐的种子。
 * 用户换成别的歌单播放后，新曲目不在 stationKeys 里，电台就不会再补充。
 */
const stationKeys = new Set<string>()
let stationSeeds: string[] = []
let refilling = false

export function isStationTrack(trackId: string) {
	return stationKeys.has(trackId)
}

/**
 * 开始电台。
 * - 传入 seed（一首或多首）：以它们为起点，推荐相关的曲目；第一首会排在队列开头
 * - 不传：以最近常听的曲目为种子；没有播放记录时使用音乐分区热门榜
 */
export async function startStation(seed?: Track | Track[]): Promise<boolean> {
	try {
		const seeds = Array.isArray(seed) ? seed : seed ? [seed] : []
		const seedBvids: string[] = []
		if (seeds.length > 0) {
			for (const item of seeds) {
				const bvid = seedBvidOf(item)
				if (bvid) seedBvids.push(bvid)
			}
		} else {
			const frequent = await getFrequentTracks()
			seedBvids.push(...frequent.map((track) => track.bilibiliMetadata.bvid))
		}

		let tracks = await fetchRecommendedTracks({
			seedBvids,
			excludeKeys: new Set(seeds.map((item) => item.uniqueKey)),
			limit: INITIAL_BATCH,
		})
		if (tracks.length === 0) {
			tracks = await fetchPopularMusicTracks(INITIAL_BATCH)
		}
		if (tracks.length === 0) {
			toast.error('おすすめできる曲が見つかりません。しばらくしてからお試しください')
			return false
		}

		// 先入库再入队：否则播放器按 uniqueKey 读取当前曲目时会 TrackNotFound
		const first = seeds[0]
		const candidates = first?.source === 'bilibili' ? [first, ...tracks] : tracks
		const queueTracks = await persistTracksToLocal(candidates)
		if (queueTracks.length === 0) {
			toast.error('ステーションを開始できません：曲情報の保存に失敗しました')
			return false
		}
		const ok = await addToQueue({
			tracks: queueTracks,
			playNow: true,
			clearQueue: true,
			playNext: false,
		})
		if (!ok) return false

		stationKeys.clear()
		for (const track of queueTracks) stationKeys.add(track.uniqueKey)
		stationSeeds = seedBvids
		toast.success(
			seeds.length > 0
				? 'ステーションを開始しました：選んだ曲をもとにおすすめ'
				: 'ステーションを開始しました',
		)
		return true
	} catch (error) {
		toastAndLogError('ステーションの開始に失敗しました', error, 'Player.Station')
		return false
	}
}

/**
 * 判断「队列放完后自动接着播放推荐」是否应该介入：
 * 只在设置开启、音乐模式、没有循环、没有随机播放，且当前正在播放队列最后一首时触发。
 */
async function shouldAutoplayAfterQueue(remaining: number): Promise<boolean> {
	if (useAppStore.getState().settings.autoPlayRecommendations === false) {
		return false
	}
	if (remaining > 0) return false
	if (playbackContextStore$.context.peek()?.mode === 'podcast') return false
	const [repeatMode, shuffle] = await Promise.all([
		Orpheus.getRepeatMode(),
		Orpheus.getShuffleMode(),
	])
	return repeatMode === RepeatMode.OFF && !shuffle
}

/**
 * 在曲目开始播放时调用：
 * - 电台的曲目：队列快播完时，追加新的推荐
 * - 其他曲目（自动再生）：正在播放队列最后一首时，接着追加推荐
 * 失败只写日志，不打扰用户（队列放完会自然停止）。
 */
export async function refillStationIfNeeded(trackId: string): Promise<void> {
	if (refilling) return
	const inStation = stationKeys.has(trackId)
	// 没有 B 站 bvid 的曲目（本地文件等）没法作为推荐种子
	const currentBvid = bvidFromUniqueKey(trackId)
	if (!inStation && !currentBvid) return
	if (
		!inStation &&
		useAppStore.getState().settings.autoPlayRecommendations === false
	) {
		return
	}

	refilling = true
	try {
		const queue = await Orpheus.getQueue()
		const index = queue.findIndex((track) => track.id === trackId)
		if (index === -1) return
		const remaining = queue.length - index - 1

		let seedBvids: string[]
		if (inStation) {
			if (remaining > REFILL_THRESHOLD) return
			seedBvids = [...(currentBvid ? [currentBvid] : []), ...stationSeeds]
		} else {
			if (!(await shouldAutoplayAfterQueue(remaining))) return
			// 以最近听的几首作为种子，推荐更贴近这次的听感
			seedBvids = queue
				.slice(-5)
				.map((track) => bvidFromUniqueKey(track.id))
				.filter((bvid): bvid is string => !!bvid)
		}
		const exclude = new Set<string>([
			...queue.map((track) => track.id),
			...stationKeys,
		])

		const tracks = await fetchRecommendedTracks({
			seedBvids,
			excludeKeys: exclude,
			limit: REFILL_BATCH,
		})
		if (tracks.length === 0) {
			logger.debug('没有可追加的推荐', { trackId })
			return
		}

		const persisted = await persistTracksToLocal(tracks)
		if (persisted.length === 0) return

		const ok = await addToQueue({
			tracks: persisted,
			playNow: false,
			clearQueue: false,
			playNext: false,
		})
		if (!ok) return
		for (const track of persisted) stationKeys.add(track.uniqueKey)
		if (!inStation) {
			// 自动再生的曲目之后按电台的方式继续补充
			stationKeys.add(trackId)
			stationSeeds = seedBvids
			toast.info('おすすめの曲を続けて再生します')
		}
		logger.info('追加了推荐曲目', { count: persisted.length, inStation })
	} catch (error) {
		logger.warning('追加推荐曲目失败', error)
	} finally {
		refilling = false
	}
}
