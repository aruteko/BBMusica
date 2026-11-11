import { Orpheus } from '@bbplayer/orpheus'

import {
	bvidFromUniqueKey,
	fetchPopularMusicTracks,
	fetchRecommendedTracks,
	getFrequentTracks,
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
 * - 传入 seed：以这首歌为起点，推荐与它相关的曲目
 * - 不传：以よく聴いている曲的曲目为种子；没有播放记录时使用音乐分区热门榜
 */
export async function startStation(seed?: Track): Promise<boolean> {
	try {
		const seedBvids: string[] = []
		if (seed) {
			const bvid = seedBvidOf(seed)
			if (bvid) seedBvids.push(bvid)
		} else {
			const frequent = await getFrequentTracks()
			seedBvids.push(...frequent.map((track) => track.bilibiliMetadata.bvid))
		}

		let tracks = await fetchRecommendedTracks({
			seedBvids,
			excludeKeys: new Set(seed ? [seed.uniqueKey] : []),
			limit: INITIAL_BATCH,
		})
		if (tracks.length === 0) {
			tracks = await fetchPopularMusicTracks(INITIAL_BATCH)
		}
		if (tracks.length === 0) {
			toast.error('おすすめできる曲が見つかりません。しばらくしてからお試しください')
			return false
		}

		const queueTracks = seed?.source === 'bilibili' ? [seed, ...tracks] : tracks
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
		toast.success(seed ? 'ステーションを開始しました：この曲をもとにおすすめ' : 'ステーションを開始しました')
		return true
	} catch (error) {
		toastAndLogError('ステーションの開始に失敗しました', error, 'Player.Station')
		return false
	}
}

/**
 * 在曲目开始播放时调用：若当前曲目属于电台且队列快播完了，就追加新的推荐。
 * 失败只写日志，不打扰用户（队列放完会自然停止）。
 */
export async function refillStationIfNeeded(trackId: string): Promise<void> {
	if (!stationKeys.has(trackId) || refilling) return
	refilling = true
	try {
		const queue = await Orpheus.getQueue()
		const index = queue.findIndex((track) => track.id === trackId)
		if (index === -1) return
		if (queue.length - index - 1 > REFILL_THRESHOLD) return

		const currentBvid = bvidFromUniqueKey(trackId)
		const seedBvids = [
			...(currentBvid ? [currentBvid] : []),
			...stationSeeds,
		]
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
			logger.debug('电台补充：没有可追加的推荐', { trackId })
			return
		}

		const ok = await addToQueue({
			tracks,
			playNow: false,
			clearQueue: false,
			playNext: false,
		})
		if (!ok) return
		for (const track of tracks) stationKeys.add(track.uniqueKey)
		logger.info('电台补充了推荐曲目', { count: tracks.length })
	} catch (error) {
		logger.warning('电台补充失败', error)
	} finally {
		refilling = false
	}
}
