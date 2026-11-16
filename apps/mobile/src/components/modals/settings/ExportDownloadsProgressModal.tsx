import { TvFocusScope } from '@bbplayer/native'
import { Orpheus } from '@bbplayer/orpheus'
import type { TrueSheet as TrueSheetType } from '@lodev09/react-native-true-sheet'
import { TrueSheet } from '@lodev09/react-native-true-sheet'
import type { RefObject } from 'react'
import { memo, useEffect, useRef, useState } from 'react'
import type { ScrollViewInstance } from 'react-native'
import { ScrollView, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import {
	Divider,
	HelperText,
	Text,
	TextInput,
	useTheme,
} from 'react-native-paper'

import Button from '@/components/common/Button'
import LinearProgressIndicator from '@/components/common/LinearProgressIndicator'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { toastAndLogError } from '@/utils/error-handling'
import { t } from '@/i18n'
import { CORNER_RADIUS } from '@/theme/dimensions'

type Stage = 'config' | 'exporting' | 'completed' | 'error'

interface ProgressState {
	current: number
	total: number
	failed: number
	stage: Stage
	message: string
}

export interface ExportDownloadsProgressModalProps {
	sheetRef: RefObject<TrueSheetType | null>
	ids: string[]
	destinationUri: string
}

const PREVIEW_VALUES: Record<string, string> = {
	id: 'bilibili::BV114514::1919810',
	name: '春日影',
	artist: 'Crychic',
	bvid: 'BV114514',
	cid: '1919810',
}

const VARIABLE_KEYS = Object.keys(PREVIEW_VALUES)

function buildPreviewFilename(pattern: string): string {
	if (!pattern.trim()) return `${PREVIEW_VALUES.name}.m4a`
	let result = pattern
	for (const [key, val] of Object.entries(PREVIEW_VALUES)) {
		result = result.replaceAll(`{${key}}`, val)
	}
	result = result.replace(/[\\/:*?"<>|]/g, '_').trim()
	return result ? `${result}.m4a` : `${PREVIEW_VALUES.name}.m4a`
}

function patternHasVariable(pattern: string): boolean {
	return VARIABLE_KEYS.some((k) => pattern.includes(`{${k}}`))
}

const ExportDownloadsProgressModal = memo(
	function ExportDownloadsProgressModal({
		sheetRef,
		ids,
		destinationUri,
	}: ExportDownloadsProgressModalProps) {
		const { colors } = useTheme()
		const scrollViewRef = useRef<ScrollViewInstance>(null)

		const [filenamePattern, setFilenamePattern] = useState('{name}')
		const [embedLyrics, setEmbedLyrics] = useState(false)
		const [convertToLrc, setConvertToLrc] = useState(false)
		const [cropCoverArt, setCropCoverArt] = useState(false)

		const [progress, setProgress] = useState<ProgressState>({
			current: 0,
			total: ids.length,
			failed: 0,
			stage: 'config',
			message: t('エクスポートを準備中...'),
		})
		const hasStarted = useRef(false)
		const subscriptionRef = useRef<{ remove(): void } | null>(null)

		const stage = progress.stage

		// Reset internal state whenever a new export session begins (ids / destination changed)
		useEffect(() => {
			setFilenamePattern('{name}')
			setEmbedLyrics(false)
			setConvertToLrc(false)
			setCropCoverArt(false)
			setProgress({
				current: 0,
				total: ids.length,
				failed: 0,
				stage: 'config',
				message: t('エクスポートを準備中...'),
			})
			hasStarted.current = false

			return () => {
				subscriptionRef.current?.remove()
				subscriptionRef.current = null
			}
		}, [ids, destinationUri])

		function startExport() {
			if (hasStarted.current) return
			hasStarted.current = true

			setProgress((prev) => ({ ...prev, stage: 'exporting' }))

			subscriptionRef.current = Orpheus.addListener(
				'onExportProgress',
				(event) => {
					setProgress((prev) => {
						const failed = prev.failed + (event.status === 'error' ? 1 : 0)
						const current = event.index ?? prev.current
						const total = event.total ?? prev.total
						const isLast = current === total

						let message = `${t('エクスポート中 ')}${current}/${total}...`
						if (event.status === 'error') {
							message = `${event.currentId}${t(' のエクスポートに失敗しました: ')}${event.message ?? t('不明なエラー')}`
						}

						if (isLast) {
							subscriptionRef.current?.remove()
							subscriptionRef.current = null
						}

						return {
							current,
							total,
							failed,
							stage: isLast ? 'completed' : 'exporting',
							message: isLast
								? failed > 0
									? `${t('エクスポート完了：')}${total - failed}${t(' 件成功、')}${failed}${t(' 件失敗')}`
									: `${total}${t(' 曲をすべてエクスポートしました')}`
								: message,
						}
					})
				},
			)

			let effectivePattern = filenamePattern.trim() || '{name}'
			if (!patternHasVariable(effectivePattern)) {
				effectivePattern = '{name}'
			}

			Orpheus.exportDownloads(
				ids,
				destinationUri,
				effectivePattern,
				embedLyrics,
				convertToLrc,
				cropCoverArt,
			).catch((e: unknown) => {
				toastAndLogError(t('まとめてエクスポートを開始できませんでした'), e, 'Modal.ExportDownloadsProgress')
				setProgress((prev) => ({
					...prev,
					stage: 'error',
					message: t('エクスポートを開始できませんでした'),
				}))
				subscriptionRef.current?.remove()
				subscriptionRef.current = null
			})
		}

		function dismiss() {
			subscriptionRef.current?.remove()
			subscriptionRef.current = null
			void sheetRef.current?.dismiss()
		}

		const isFinished = stage === 'completed' || stage === 'error'
		const progressValue =
			progress.total > 0 ? progress.current / progress.total : undefined

		const stageTitle =
			stage === 'config'
				? t('エクスポート設定')
				: stage === 'completed'
					? t('エクスポートが完了しました')
					: stage === 'error'
						? t('エクスポートに失敗しました')
						: t('曲をまとめてエクスポート中')

		return (
			<TrueSheet
				ref={sheetRef}
				detents={['auto']}
				cornerRadius={24}
				backgroundColor={colors.elevation.level1}
				style={{ flex: 1 }}
				scrollableRef={scrollViewRef}
				dismissible={stage === 'config' || isFinished}
				onDidDismiss={() => {
					setProgress({
						current: 0,
						total: ids.length,
						failed: 0,
						stage: 'config',
						message: t('エクスポートを準備中...'),
					})
					hasStarted.current = false
					setFilenamePattern('{name}')
					setEmbedLyrics(false)
					setConvertToLrc(false)
					setCropCoverArt(false)
					subscriptionRef.current?.remove()
					subscriptionRef.current = null
				}}
			>
				<TvFocusScope style={{ flex: 1 }}>
					<GestureHandlerRootView style={{ flex: 1 }}>
						<View style={styles.sheetHeader}>
							<Text
								variant='titleLarge'
								style={styles.sheetTitle}
							>
								{stageTitle}
							</Text>
						</View>
						<ScrollView
							ref={scrollViewRef}
							style={{ flex: 1 }}
							contentContainerStyle={styles.sheetContent}
							nestedScrollEnabled
						>
							{stage === 'config' ? (
								<>
									{/* ── 文件名模板 ── */}
									<Text
										variant='labelLarge'
										style={styles.sectionTitle}
									>{t('ファイル名のテンプレート')}</Text>
									<TextInput
										label={t('ファイル名のテンプレート')}
										value={filenamePattern}
										onChangeText={setFilenamePattern}
										mode='outlined'
										placeholder='{name}'
										autoCapitalize='none'
										autoCorrect={false}
										dense
									/>
									<HelperText
										type={
											!filenamePattern.trim() ||
											patternHasVariable(filenamePattern)
												? 'info'
												: 'error'
										}
										visible
										style={styles.helperText}
									>
										{!filenamePattern.trim()
											? t('空の場合は既定のテンプレート {name} を使います')
											: patternHasVariable(filenamePattern)
												? `${t('プレビュー：')}${buildPreviewFilename(filenamePattern)}`
												: t('テンプレートに変数が含まれていないため、{name} に置き換えます')}
									</HelperText>
									{/* 可用变量说明 */}
									<View style={styles.variableBox}>
										<Text
											variant='labelSmall'
											style={styles.variableTitle}
										>{t('使える変数')}</Text>
										{[
											['id', t('曲の一意のID')],
											['name', t('曲のタイトル')],
											['artist', t('アーティスト')],
											['bvid', t('BilibiliのBV番号')],
											['cid', t('BilibiliのCID')],
										].map(([v, desc]) => (
											<Text
												key={v}
												variant='bodySmall'
												style={styles.variableRow}
											>
												<Text style={styles.variableTag}>{`{${v}}`}</Text>
												{'  '}
												{desc}
											</Text>
										))}
									</View>

									<Divider style={styles.divider} />

									{/* ── 内嵌歌词开关 ── */}
									<View style={styles.switchRow}>
										<View style={styles.switchLabel}>
											<Text variant='labelLarge'>{t('歌詞を埋め込む')}</Text>
										</View>
										<UniversalSwitch
											value={embedLyrics}
											onValueChange={setEmbedLyrics}
										/>
									</View>
									<HelperText
										type='info'
										visible
										style={styles.helperText}
									>{t('歌詞ページを開いた曲だけ、歌詞を埋め込めます')}</HelperText>

									{/* ── SPL → LRC 开关（仅 embedLyrics 开启时显示）── */}
									{embedLyrics && (
										<>
											<Divider style={styles.divider} />
											<View style={styles.switchRow}>
												<View style={styles.switchLabel}>
													<Text variant='labelLarge'>{t('標準のLRCに変換')}</Text>
												</View>
												<UniversalSwitch
													value={convertToLrc}
													onValueChange={setConvertToLrc}
												/>
											</View>
											<HelperText
												type='info'
												visible
												style={styles.helperText}
											>{t('標準のLRCに変換します')}</HelperText>
										</>
									)}

									<Divider style={styles.divider} />

									{/* ── 裁剪封面开关 ── */}
									<View style={styles.switchRow}>
										<View style={styles.switchLabel}>
											<Text variant='labelLarge'>{t('カバーを正方形に切り抜く')}</Text>
										</View>
										<UniversalSwitch
											value={cropCoverArt}
											onValueChange={setCropCoverArt}
										/>
									</View>
									<HelperText
										type='info'
										visible
										style={styles.helperText}
									>{t('カバーを中央から1:1に切り抜きます')}</HelperText>

									<Divider style={styles.divider} />

									<View style={styles.actionRow}>
										<Button onPress={dismiss}>{t('キャンセル')}</Button>
										<Button
											mode='contained'
											onPress={startExport}
										>{t('エクスポートを開始')}</Button>
									</View>
								</>
							) : (
								<>
									<View style={styles.progressContent}>
										<Text
											variant='bodyMedium'
											style={styles.message}
											numberOfLines={2}
										>
											{progress.message}
										</Text>
										<LinearProgressIndicator
											progress={isFinished ? 1 : progressValue}
											indeterminate={!isFinished && progressValue === undefined}
											style={styles.progressBar}
										/>
									</View>

									<View style={styles.actionRow}>
										<Button
											onPress={dismiss}
											disabled={!isFinished}
										>
											{isFinished ? t('閉じる') : t('お待ちください')}
										</Button>
									</View>
								</>
							)}
						</ScrollView>
					</GestureHandlerRootView>
				</TvFocusScope>
			</TrueSheet>
		)
	},
)

ExportDownloadsProgressModal.displayName = 'ExportDownloadsProgressModal'

const styles = StyleSheet.create({
	sheetContent: {
		paddingHorizontal: 24,
		paddingTop: 8,
		gap: 2,
	},
	sheetHeader: {
		paddingHorizontal: 24,
		paddingTop: 26,
		paddingBottom: 16,
	},
	sheetTitle: {
		fontWeight: '700',
	},
	sectionTitle: {
		marginBottom: 6,
		marginTop: 4,
	},
	helperText: {
		marginTop: 0,
		paddingHorizontal: 0,
	},
	variableBox: {
		marginTop: 8,
		marginBottom: 4,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: CORNER_RADIUS,
		gap: 4,
		backgroundColor: 'rgba(128,128,128,0.08)',
	},
	variableTitle: {
		marginBottom: 4,
		opacity: 0.6,
	},
	variableRow: {
		opacity: 0.8,
	},
	variableTag: {
		fontFamily: 'monospace',
		fontWeight: '600',
	},
	divider: {
		marginVertical: 12,
	},
	switchRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	switchLabel: {
		flex: 1,
		paddingRight: 8,
	},
	actionRow: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 8,
		marginTop: 8,
	},
	progressContent: {
		gap: 15,
		paddingVertical: 10,
	},
	message: {
		textAlign: 'center',
		height: 40,
	},
	progressBar: {
		height: 8,
		borderRadius: 4,
	},
})

export default ExportDownloadsProgressModal
