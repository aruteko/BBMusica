import { Orpheus } from '@bbplayer/orpheus'
import { memo, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import LinearProgressIndicator from '@/components/common/LinearProgressIndicator'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'
import { t } from '@/i18n'

interface ProgressState {
	current: number
	total: number
	failed: number
	stage: 'pending' | 'downloading' | 'completed' | 'error'
	message: string
}

const CoverDownloadProgressModal = memo(function CoverDownloadProgressModal() {
	const close = useModalStore((state) => state.close)
	const [progress, setProgress] = useState<ProgressState>({
		current: 0,
		total: 0,
		failed: 0,
		stage: 'pending',
		message: t('準備中...'),
	})
	const hasStarted = useRef(false)

	useEffect(() => {
		if (hasStarted.current) return
		hasStarted.current = true

		const subscription = Orpheus.addListener(
			'onCoverDownloadProgress',
			(event) => {
				setProgress((prev) => {
					const failed = prev.failed + (event.status === 'failed' ? 1 : 0)
					const isLast = event.current === event.total
					return {
						current: event.current,
						total: event.total,
						failed,
						stage: isLast ? 'completed' : 'downloading',
						message: isLast
							? failed > 0
								? `${t('完了：')}${event.total - failed}${t(' 件成功、')}${failed}${t(' 件失敗')}`
								: `${event.total}${t(' 件のカバーをすべてダウンロードしました')}`
							: `${t('ダウンロード中 ')}${event.current}/${event.total}...`,
					}
				})
			},
		)

		Orpheus.downloadMissingCovers()
			.then((total) => {
				if (total === 0) {
					setProgress({
						current: 0,
						total: 0,
						failed: 0,
						stage: 'completed',
						message: t('すべてのカバーがそろっているため、ダウンロードは不要です'),
					})
				}
			})
			.catch((e: unknown) => {
				toastAndLogError(t('不足しているカバーのダウンロードに失敗しました'), e, 'Modal.CoverDownloadProgress')
				setProgress((prev) => ({
					...prev,
					stage: 'error',
					message: t('ダウンロードを開始できませんでした'),
				}))
			})

		return () => {
			subscription.remove()
		}
	}, [])

	const isFinished =
		progress.stage === 'completed' || progress.stage === 'error'
	const progressValue =
		progress.total > 0 ? progress.current / progress.total : undefined

	return (
		<>
			<Dialog.Title>
				{progress.stage === 'completed'
					? t('ダウンロードが完了しました')
					: progress.stage === 'error'
						? t('ダウンロードに失敗しました')
						: t('不足しているカバーをダウンロード中')}
			</Dialog.Title>
			<Dialog.Content>
				<View style={styles.content}>
					<Text
						variant='bodyMedium'
						style={styles.message}
					>
						{progress.message}
					</Text>
					<LinearProgressIndicator
						progress={isFinished ? 1 : progressValue}
						indeterminate={!isFinished && progressValue === undefined}
						style={styles.progressBar}
					/>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('CoverDownloadProgress')}
					disabled={!isFinished}
				>
					{isFinished ? t('閉じる') : t('お待ちください')}
				</Button>
			</Dialog.Actions>
		</>
	)
})

CoverDownloadProgressModal.displayName = 'CoverDownloadProgressModal'

const styles = StyleSheet.create({
	content: {
		gap: 15,
		paddingVertical: 10,
	},
	message: {
		textAlign: 'center',
	},
	progressBar: {
		height: 8,
		borderRadius: 4,
	},
})

export default CoverDownloadProgressModal
