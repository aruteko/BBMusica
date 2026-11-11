import { bilibiliApi } from '@/lib/api/bilibili/api'
import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import { trackService } from '@/lib/services/trackService'
import type { BilibiliFeedVideo } from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'

/** B 站「音乐」分区的排行榜 rid */
const MUSIC_PARTITION = '3'
/** 过滤掉过短（片段、预告）与过长（合集、直播回放）的视频，保证更像「歌曲」 */
const MIN_DURATION_SECONDS = 60
const MAX_DURATION_SECONDS = 15 * 60

const BILIBILI_KEY_PREFIX = 'bilibili::'

export function feedVideoToTrack(video: BilibiliFeedVideo): BilibiliTrack {
	const date = new Date(video.pubdate * 1000)
	return {
		id: video.aid,
		uniqueKey: `${BILIBILI_KEY_PREFIX}${video.bvid}`,
		source: 'bilibili',
		title: video.title,
		artist: {
			id: video.owner.mid,
			name: video.owner.name,
			avatarUrl: video.owner.face,
			remoteId: video.owner.mid.toString(),
			source: 'bilibili',
			createdAt: date,
			updatedAt: date,
		},
		coverUrl: video.pic,
		duration: video.duration,
		createdAt: date,
		updatedAt: date,
		bilibiliMetadata: {
			bvid: video.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: true,
		},
	}
}

/**
 * 把曲目录入本地数据库。
 *
 * 播放器（usePlayerStore）和播放记录都是按 uniqueKey 从数据库读取曲目的，
 * 未入库的曲目会报 TrackNotFound。搜索结果的播放流程也是先入库再入队，这里保持一致。
 * 入库失败的曲目会被丢弃（不会进入播放队列）。
 */
export async function persistTracksToLocal<T extends Track>(
	tracks: T[],
): Promise<T[]> {
	const persisted: T[] = []
	for (const track of tracks) {
		const result = await syncFacade.addTrackToLocal(track)
		if (result.isOk()) persisted.push(track)
	}
	return persisted
}

/** 从 uniqueKey（`bilibili::BVxxx` 或 `bilibili::BVxxx::cid`）里取出 bvid */
export function bvidFromUniqueKey(uniqueKey: string): string | undefined {
	if (!uniqueKey.startsWith(BILIBILI_KEY_PREFIX)) return undefined
	return uniqueKey.slice(BILIBILI_KEY_PREFIX.length).split('::')[0] || undefined
}

function isSongLike(video: BilibiliFeedVideo) {
	return (
		video.duration >= MIN_DURATION_SECONDS &&
		video.duration <= MAX_DURATION_SECONDS
	)
}

function shuffle<T>(items: T[]): T[] {
	const result = [...items]
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[result[i], result[j]] = [result[j], result[i]]
	}
	return result
}

/**
 * 取「最近常听」的 B 站曲目，作为推荐的种子 / 首页展示。
 * 查询失败时返回空数组，推荐会退回到热门榜。
 */
export async function getFrequentTracks({
	days = 30,
	limit = 20,
}: { days?: number; limit?: number } = {}): Promise<BilibiliTrack[]> {
	const result = await trackService.getMostPlayedTracksInLastDays({
		days,
		limit,
	})
	if (result.isErr()) return []
	return result.value
		.map((row) => row.track)
		.filter((track): track is BilibiliTrack => track.source === 'bilibili')
}

/** 音乐分区热门榜 */
export async function fetchPopularMusicTracks(
	limit = 30,
): Promise<BilibiliTrack[]> {
	const result = await bilibiliApi.getPopularVideos({
		partition: MUSIC_PARTITION,
	})
	if (result.isErr()) throw result.error
	return result.value.filter(isSongLike).slice(0, limit).map(feedVideoToTrack)
}

/**
 * 根据种子视频（bvid）的「相关视频」生成推荐列表。
 * 多个种子都推荐的视频得分更高；同分按随机顺序，避免每次结果完全一样。
 *
 * @param seedBvids 种子视频，会随机抽取最多 `seedCount` 个
 * @param excludeKeys 不希望出现的曲目 uniqueKey（已在队列里的、种子本身等）
 */
export async function fetchRecommendedTracks({
	seedBvids,
	excludeKeys = new Set<string>(),
	limit = 30,
	seedCount = 4,
}: {
	seedBvids: string[]
	excludeKeys?: ReadonlySet<string>
	limit?: number
	seedCount?: number
}): Promise<BilibiliTrack[]> {
	const seeds = shuffle(Array.from(new Set(seedBvids))).slice(0, seedCount)
	const seedKeys = new Set(seeds.map((bvid) => `${BILIBILI_KEY_PREFIX}${bvid}`))

	const lists = await Promise.all(
		seeds.map(async (bvid) => {
			const result = await bilibiliApi.getRelatedVideos({ bvid })
			return result.isOk() ? result.value : []
		}),
	)

	const scored = new Map<string, { video: BilibiliFeedVideo; score: number }>()
	for (const list of lists) {
		list.forEach((video, index) => {
			const key = `${BILIBILI_KEY_PREFIX}${video.bvid}`
			if (excludeKeys.has(key) || seedKeys.has(key) || !isSongLike(video)) {
				return
			}
			// 排名靠前的相关视频权重更高
			const weight = 1 + (list.length - index) / Math.max(list.length, 1)
			const entry = scored.get(video.bvid)
			if (entry) entry.score += weight
			else scored.set(video.bvid, { video, score: weight })
		})
	}

	const ranked = Array.from(scored.values())
		.map((entry) => ({ ...entry, score: entry.score + Math.random() * 0.5 }))
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((entry) => feedVideoToTrack(entry.video))

	return ranked
}

/**
 * 首页「为你推荐」：用最近常听的曲目做种子；没有听歌记录或相关视频获取失败时，
 * 用音乐分区热门榜补足。
 */
export async function fetchHomeRecommendations(
	limit = 20,
): Promise<{ tracks: BilibiliTrack[]; seeded: boolean }> {
	const frequent = await getFrequentTracks()
	const seedBvids = frequent
		.map((track) => track.bilibiliMetadata.bvid)
		.filter(Boolean)
	const excludeKeys = new Set(frequent.map((track) => track.uniqueKey))

	const recommended =
		seedBvids.length > 0
			? await fetchRecommendedTracks({ seedBvids, excludeKeys, limit })
			: []
	if (recommended.length >= Math.min(limit, 8)) {
		return { tracks: recommended, seeded: true }
	}

	const popular = await fetchPopularMusicTracks(limit * 2)
	const seen = new Set(recommended.map((track) => track.uniqueKey))
	const filler = popular.filter(
		(track) => !seen.has(track.uniqueKey) && !excludeKeys.has(track.uniqueKey),
	)
	return {
		tracks: [...recommended, ...filler].slice(0, limit),
		seeded: recommended.length > 0,
	}
}

/** 供类型使用：把任意 Track 当作种子时取 bvid（仅 B 站曲目有） */
export function seedBvidOf(track: Track): string | undefined {
	return track.source === 'bilibili' ? track.bilibiliMetadata.bvid : undefined
}
