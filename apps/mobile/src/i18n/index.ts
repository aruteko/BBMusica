/**
 * 日本語 / 中国語の切り替え。
 *
 * ソースの文字列は日本語で書き、中国語のときだけ `zh` の表で置き換える。
 *   t('ログイン')  →  日本語のとき 'ログイン' / 中国語のとき '登录'
 * 言語は、アプリを起動したときに一度だけ決める（切り替えたあとは、再起動で反映）。
 */
import { storage } from '@/utils/mmkv-instance'

import { zh } from './zh'

export type LanguageSetting = 'auto' | 'ja' | 'zh'
export type AppLanguage = 'ja' | 'zh'

/** 端末の言語が中国語なら中国語、それ以外は日本語 */
function detectDeviceLanguage(): AppLanguage {
	try {
		const locale = Intl.DateTimeFormat().resolvedOptions().locale
		return locale.toLowerCase().startsWith('zh') ? 'zh' : 'ja'
	} catch {
		return 'ja'
	}
}

export function getLanguageSetting(): LanguageSetting {
	const value = storage.getString('app_language')
	return value === 'ja' || value === 'zh' ? value : 'auto'
}

export function setLanguageSetting(setting: LanguageSetting): void {
	if (setting === 'auto') storage.remove('app_language')
	else storage.set('app_language', setting)
}

const setting = getLanguageSetting()

/** 今の言語（起動時に決まる） */
export const language: AppLanguage =
	setting === 'auto' ? detectDeviceLanguage() : setting

/**
 * 日本語の文字列を、今の言語の文字列にする（中国語の訳がなければ、そのまま日本語）。
 * 値を入れたいところは {0} {1} と書き、あとの引数で渡す。
 *   t('{0} 曲を取得しました', count)
 */
export function t(text: string, ...args: (string | number)[]): string {
	const translated = language === 'zh' ? (zh[text] ?? text) : text
	if (args.length === 0) return translated
	return translated.replace(/\{(\d+)\}/g, (match, index: string) =>
		String(args[Number(index)] ?? match),
	)
}
