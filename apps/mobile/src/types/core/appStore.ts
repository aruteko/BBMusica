import type { Result } from 'neverthrow'

interface Settings {
	defaultPlayerMode: 'music' | 'podcast'
	podcastSubtitleLanguage?: string
	sendPlayHistory: boolean
	enableDebugLog: boolean
	enableOldSchoolStyleLyric: boolean
	playerBackgroundStyle: 'gradient' | 'fluid'
	pureWhiteBackground: boolean
	/** テーマのメインカラーで、アプリ全体の配色を変える。未設定（旧版本）は、オン扱い */
	skinAccentColor?: boolean
	nowPlayingBarStyle: 'float' | 'bottom'
	lyricSource: 'auto' | 'netease' | 'qqmusic' | 'kugou'
	enableVerbatimLyrics: boolean
	enableDataCollection: boolean
	downloadMaxParallelTasks: number
	enableMinimalistMode: boolean
	allowSimultaneousPlayback: boolean
	expandMultiPageOnSync: boolean | null // null = 用户尚未选择过（首次同步时询问）
	/** 播放队列放完时，自动接着播放相似的推荐曲目 */
	/** 未设置（旧版本保存的设置）时视为开启 */
	autoPlayRecommendations?: boolean
	hideStarPrompt: boolean // 用户是否点击过「不再显示」Star 提示
}

interface BilibiliUserSummary {
	mid?: number
	name?: string
	face?: string
	cachedAt?: number
}

interface AppState {
	bilibiliCookie: Record<string, string> | null
	bilibiliUserInfo: BilibiliUserSummary | null
	settings: Settings

	// Cookies
	hasBilibiliCookie: () => boolean
	setBilibiliCookie: (cookieString: string) => Result<void, Error>
	updateBilibiliCookie: (updates: Record<string, string>) => Result<void, Error>
	clearBilibiliCookie: () => void
	setBilibiliUserInfo: (info: BilibiliUserSummary | null) => void

	// Settings
	setSettings: (updates: Partial<Settings>) => void

	setEnableDebugLog: (value: boolean) => void
	setEnableDataCollection: (value: boolean) => void
}

export type { AppState, BilibiliUserSummary, Settings }
