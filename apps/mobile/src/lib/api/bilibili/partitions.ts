/**
 * B 站分区（tid）。这里只列出和「找歌」有关的音乐区及其子分区。
 */

/**
 * 音乐区里不是歌曲的分区：乐评盘点、音乐教学、电台。
 * 「音乐综合」「演奏」「AI音乐」里歌曲和杂项混在一起，推荐相关视频时不一概排除。
 */
export const NON_SONG_PARTITION_TIDS: readonly number[] = [243, 244, 267]

/** 标题里带这些词的，多半是盘点 / 解说 / 合集 / 教学，而不是一首歌 */
const NON_SONG_TITLE_PATTERN =
	/(合集|盘点|开箱|纪录片|教学|教程|解说|测评|评价|评测|鉴赏|乐评|科普|采访|串烧|混剪|reaction|全场|完整版演唱会|纪实)/i

export function looksLikeNonSongTitle(title: string): boolean {
	if (NON_SONG_TITLE_PATTERN.test(title)) return true
	// 标签堆砌（#xxx #yyy #zzz）的多半是短视频
	return (title.match(/#/g)?.length ?? 0) >= 3
}
