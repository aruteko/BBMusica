/**
 * B 站分区（tid）。这里只列出和「找歌」有关的音乐区及其子分区。
 */

/** 音乐区（父分区）。搜索接口的 tids=3 会包含它的所有子分区。 */
export const MUSIC_PARTITION_TID = 3

/** 子分区里内容基本是「歌曲」的分区：原创音乐、音乐现场、VOCALOID·UTAU、翻唱、MV */
export const SONG_PARTITION_TIDS: readonly number[] = [28, 29, 30, 31, 193]

/**
 * 音乐区里不是歌曲的分区：乐评盘点、音乐教学、电台。
 * 「音乐综合」「演奏」「AI音乐」里歌曲和杂项混在一起，没有放进上面的歌曲分区，
 * 但在推荐相关视频时也不一概排除。
 */
export const NON_SONG_PARTITION_TIDS: readonly number[] = [243, 244, 267]

const MUSIC_TIDS = new Set<number>([
	MUSIC_PARTITION_TID,
	...SONG_PARTITION_TIDS,
	59, // 演奏
	130, // 音乐综合
	265, // AI音乐
	...NON_SONG_PARTITION_TIDS,
])

/**
 * 搜索结果里「音乐」的定义：属于音乐区，但不是乐评 / 教学 / 电台这类非歌曲内容。
 * 这和用户的直觉一致：音乐评论不是楽曲。
 */
const MUSIC_FILTER_TIDS = new Set<number>(
	[...MUSIC_TIDS].filter((tid) => !NON_SONG_PARTITION_TIDS.includes(tid)),
)

export function isMusicVideoTid(tid: number | string | undefined | null) {
	const value = Number(tid)
	return Number.isFinite(value) && MUSIC_FILTER_TIDS.has(value)
}

/** 标题里带这些词的，多半是盘点 / 解说 / 合集 / 教学，而不是一首歌 */
const NON_SONG_TITLE_PATTERN =
	/(合集|盘点|开箱|纪录片|教学|教程|解说|测评|评价|评测|鉴赏|乐评|科普|采访|串烧|混剪|reaction|全场|完整版演唱会|纪实)/i

export function looksLikeNonSongTitle(title: string): boolean {
	if (NON_SONG_TITLE_PATTERN.test(title)) return true
	// 标签堆砌（#xxx #yyy #zzz）的多半是短视频
	return (title.match(/#/g)?.length ?? 0) >= 3
}
