import type { LyricLine } from '@bbplayer/splash'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

import { subtitlesToLrc } from './subtitles'
import { t } from '@/i18n'

const safeFilePart = (value: string, length: number) =>
	Array.from(value.replace(/[/\\?%*:|"<>]/g, '-').trim())
		.map((character) => {
			const code = character.charCodeAt(0)
			return code < 32 || code === 127 ? '-' : character
		})
		.slice(0, length)
		.join('')

export async function exportSubtitles(
	lines: LyricLine[],
	title: string,
	language: string,
) {
	if (!lines.length) throw new Error(t('書き出せる字幕がありません'))
	if (!(await Sharing.isAvailableAsync())) {
		throw new Error(t('当前设备不支持文件共有'))
	}
	const name = `${safeFilePart(title, 50)} - ${safeFilePart(language, 20)}`
	const file = new File(Paths.cache, `${name || t('Bilibili字幕')}.lrc`)
	file.create({ overwrite: true })
	await file.write(subtitlesToLrc(lines, title))
	await Sharing.shareAsync(file.uri, {
		mimeType: 'text/plain',
		UTI: 'public.plain-text',
		dialogTitle: t('字幕をLRCでエクスポート'),
	})
}
