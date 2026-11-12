import {
	canRequestPackageInstallsAsync,
	downloadAndInstallApkAsync,
	getSupportedAbisAsync,
	openPackageInstallerSettingsAsync,
} from '@bbplayer/native'
import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { Dialog, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { UpdateDownloads } from '@/lib/services/updateService'
import { storage } from '@/utils/mmkv'
import toast from '@/utils/toast'

export interface UpdateModalProps {
	version: string
	notes: string
	listed_notes?: string[]
	forced?: boolean
	url: string
	downloads?: UpdateDownloads
}

export default function UpdateAppModal({
	version,
	notes,
	listed_notes,
	url,
	downloads,
	forced = false,
}: UpdateModalProps) {
	const colors = useTheme().colors
	const modalClose = useModalStore((state) => state.close)
	const close = useCallback(() => modalClose('UpdateApp'), [modalClose])
	const [isUpdating, setIsUpdating] = useState(false)

	const onUpdate = async () => {
		if (isUpdating) return
		if (Platform.OS !== 'android') {
			await openReleaseUrl()
			return
		}

		let toastId: string | number | undefined
		try {
			const canInstall = await canRequestPackageInstallsAsync()
			if (!canInstall) {
				await openPackageInstallerSettingsAsync()
				toast.info('BBPlayerに不明なアプリのインストールを許可してから、もう一度更新してください')
				return
			}

			setIsUpdating(true)
			toastId = toast.loading('アップデートをダウンロード中', {
				description: 'ダウンロード後、システムのインストーラーが開きます',
				duration: Infinity,
			})
			const downloadUrl = await resolveAndroidDownloadUrl()
			if (!downloadUrl) {
				toast.dismiss(toastId)
				await openReleaseUrl()
				setIsUpdating(false)
				return
			}
			await downloadAndInstallApkAsync({
				url: downloadUrl,
				fileName: buildApkFileName(version),
				title: `BBPlayer ${version}`,
				description: 'ダウンロード後にアップデートをインストールします',
			})
			toast.success('アップデートのダウンロードが完了しました', { id: toastId })
			close()
		} catch (e) {
			toast.error('アップデートに失敗しました。ダウンロードのリンクをクリップボードにコピーしました', {
				description: String(e),
				id: toastId,
			})
			void Clipboard.setStringAsync(url)
		}
		setIsUpdating(false)
	}

	const openReleaseUrl = async () => {
		try {
			if (url) await WebBrowser.openBrowserAsync(url)
		} catch (e) {
			void Clipboard.setStringAsync(url)
			toast.error('ブラウザを開けないため、リンクをクリップボードにコピーしました', {
				description: String(e),
			})
		}
		close()
	}

	const resolveAndroidDownloadUrl = async (): Promise<string | null> => {
		if (!downloads?.android) return isApkUrl(url) ? url : null
		const supportedAbis = await getSupportedAbisAsync()
		for (const abi of supportedAbis) {
			const abiUrl = downloads.android[abi]
			if (abiUrl) return abiUrl
		}
		return downloads.android.universal ?? (isApkUrl(url) ? url : null)
	}

	const onSkip = () => {
		storage.set('skip_version', version)
		close()
	}

	const onCancel = () => {
		close()
	}

	return (
		<>
			<Dialog.Title testID='update-app-title'>
				新しいバージョン {version} があります
			</Dialog.Title>
			<Dialog.Content>
				{forced ? (
					<Text style={[styles.forcedText, { color: colors.error }]}>
						このアップデートは必須です。インストールしないと、続けて使えません。
					</Text>
				) : null}
				{listed_notes && listed_notes.length > 0 ? (
					listed_notes.map((note, index) => (
						<Text
							selectable
							// oxlint-disable-next-line react/no-array-index-key
							key={index}
							style={styles.noteText}
						>
							{`• ${note}`}
						</Text>
					))
				) : (
					<Text selectable>
						{/* 小米对联，偷了！ */}
						{notes?.trim() || '安定性と動作の滑らかさを改善しました'}
					</Text>
				)}
			</Dialog.Content>
			<Dialog.Actions style={styles.actionsContainer}>
				{!forced ? (
					<Button
						onPress={onSkip}
						disabled={isUpdating}
					>
						このバージョンをスキップ
					</Button>
				) : (
					<View />
				)}
				<View style={styles.rightActionsContainer}>
					<Button
						testID='update-app-cancel'
						onPress={onCancel}
						disabled={forced || isUpdating}
					>
						キャンセル
					</Button>
					<Button
						onPress={onUpdate}
						disabled={isUpdating}
					>
						{isUpdating ? 'ダウンロード中' : '更新する'}
					</Button>
				</View>
			</Dialog.Actions>
		</>
	)
}

const isApkUrl = (value: string) => value.toLowerCase().includes('.apk')

const buildApkFileName = (version: string) =>
	`BBPlayer-${version}-${Date.now()}.apk`

const styles = StyleSheet.create({
	forcedText: {
		marginBottom: 8,
		fontWeight: 'bold',
	},
	noteText: {
		marginBottom: 4,
	},
	actionsContainer: {
		justifyContent: 'space-between',
	},
	rightActionsContainer: {
		flexDirection: 'row',
	},
})
