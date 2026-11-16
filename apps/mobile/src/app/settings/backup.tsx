import { exportBackupToDownloads } from '@bbplayer/native'
import * as Expo from 'expo'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Divider,
	List,
	Text,
	TextInput,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import { alert } from '@/components/modals/AlertModal'
import {
	useCloudBackupMutation,
	useCloudRestoreMutation,
	useTestWebDavConnectionMutation,
} from '@/hooks/mutations/backup'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	normalizeWebDavBackupConfig,
	useWebDavBackups,
} from '@/hooks/queries/backup'
import { createBackup } from '@/lib/backup/export'
import { restoreBackup } from '@/lib/backup/import'
import {
	createMobileWebDavClient,
	getWebDavPassword,
	getStoredWebDavConfig,
	saveWebDavConfig,
} from '@/lib/backup/webdav'
import type { WebDavEntry } from '@/lib/backup/webdav-client'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'
import { t } from '@/i18n'

export default function BackupSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const [initialConfig] = useState(getStoredWebDavConfig)
	const didInitialRefresh = useRef(false)

	const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? '')
	const [username, setUsername] = useState(initialConfig?.username ?? '')
	const [password, setPassword] = useState('')
	const [directory, setDirectory] = useState(
		initialConfig?.directory ?? '/BBMusica',
	)
	const [isExporting, setIsExporting] = useState(false)
	const [isImporting, setIsImporting] = useState(false)
	const isExportingRef = useRef(false)
	const isImportingRef = useRef(false)
	const isPasswordEditedRef = useRef(false)

	const currentConfig = useCallback(
		() => normalizeWebDavBackupConfig({ baseUrl, username, directory }),
		[baseUrl, directory, username],
	)

	const {
		data: entries,
		isFetching: isRefreshing,
		refetch: refetchBackups,
	} = useWebDavBackups(currentConfig(), password)
	const testConnectionMutation = useTestWebDavConnectionMutation()
	const cloudBackupMutation = useCloudBackupMutation()
	const cloudRestoreMutation = useCloudRestoreMutation(showRestartPrompt)

	useEffect(() => {
		if (!initialConfig || didInitialRefresh.current) return
		didInitialRefresh.current = true
		void refetchBackups({ throwOnError: true }).catch((error) =>
			toastAndLogError(t('クラウドバックアップの読み込みに失敗しました'), error, 'UI.Settings.Backup'),
		)
	}, [initialConfig, refetchBackups])

	useEffect(() => {
		void getWebDavPassword().then((savedPassword) => {
			if (!isPasswordEditedRef.current) {
				const value = savedPassword ?? ''
				setPassword(value)
			}
		})
	}, [])

	const handleSaveConfig = async () => {
		try {
			const config = currentConfig()
			await createMobileWebDavClient(config, password)
			await saveWebDavConfig(config, password || undefined)
			toast.success(t('WebDAVの設定を保存しました'))
		} catch (error) {
			toastAndLogError(t('WebDAV設定の保存に失敗しました'), error, 'UI.Settings.Backup')
		}
	}

	const handleRefreshBackups = async () => {
		try {
			await refetchBackups({ throwOnError: true })
			toast.success(t('クラウドバックアップの一覧を更新しました'))
		} catch (error) {
			toastAndLogError(t('クラウドバックアップの読み込みに失敗しました'), error, 'UI.Settings.Backup')
		}
	}

	const handleLocalExport = async () => {
		if (isExportingRef.current) return
		isExportingRef.current = true
		setIsExporting(true)
		let backupFile: File | undefined
		try {
			const uri = await createBackup()
			backupFile = new File(uri)
			const downloadsUri = exportBackupToDownloads(
				uri,
				`backup-${Date.now()}.zip`,
				'application/zip',
			)
			if (!downloadsUri) throw new Error(t('ファイルを書き込めません'))
			toast.success(t('ダウンロード/bbplayer-backup にエクスポートしました'))
		} catch (error) {
			toastAndLogError(t('エクスポートに失敗しました'), error, 'UI.Settings.Backup')
		} finally {
			setIsExporting(false)
			isExportingRef.current = false
			if (backupFile?.exists) backupFile.delete()
		}
	}

	const handleLocalImport = async () => {
		if (isImportingRef.current) return
		isImportingRef.current = true
		setIsImporting(true)
		try {
			const result = await DocumentPicker.getDocumentAsync()
			const file = result.canceled ? undefined : result.assets?.[0]
			if (!file) return
			await restoreBackup(file.uri)
			showRestartPrompt()
		} catch (error) {
			toastAndLogError(t('インポートに失敗しました'), error, 'UI.Settings.Backup')
		} finally {
			setIsImporting(false)
			isImportingRef.current = false
		}
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={t('データとバックアップ')} />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 110 : 40) },
				]}
			>
				<SettingsSectionTitle
					title={t('ローカルバックアップ')}
					first
				/>
				<View style={styles.buttonRow}>
					<Button
						mode='outlined'
						icon='export-variant'
						loading={isExporting}
						disabled={isExporting}
						onPress={() => void handleLocalExport()}
					>{t('データをエクスポート')}</Button>
					<Button
						mode='outlined'
						icon='import'
						loading={isImporting}
						disabled={isImporting}
						onPress={() => void handleLocalImport()}
					>{t('データをインポート')}</Button>
				</View>

				<Divider style={styles.divider} />
				<SettingsSectionTitle title='WebDAV' />
				<TextInput
					label={t('サーバーのアドレス')}
					placeholder='https://example.com/dav'
					mode='outlined'
					value={baseUrl}
					autoCapitalize='none'
					autoCorrect={false}
					keyboardType='url'
					onChangeText={setBaseUrl}
					style={styles.input}
				/>
				<TextInput
					label={t('ユーザー名')}
					mode='outlined'
					value={username}
					autoCapitalize='none'
					autoCorrect={false}
					onChangeText={setUsername}
					style={styles.input}
				/>
				<TextInput
					label={t('パスワード')}
					mode='outlined'
					value={password}
					secureTextEntry
					autoCapitalize='none'
					autoCorrect={false}
					onChangeText={(value) => {
						isPasswordEditedRef.current = true
						setPassword(value)
					}}
					style={styles.input}
				/>
				<TextInput
					label={t('リモートのフォルダー')}
					mode='outlined'
					value={directory}
					autoCapitalize='none'
					autoCorrect={false}
					onChangeText={setDirectory}
					style={styles.input}
				/>
				<View style={styles.buttonRow}>
					<Button
						mode='outlined'
						loading={testConnectionMutation.isPending}
						disabled={!baseUrl.trim() || testConnectionMutation.isPending}
						onPress={() =>
							testConnectionMutation.mutate({
								config: currentConfig(),
								password,
							})
						}
					>{t('接続をテスト')}</Button>
					<Button
						mode='contained-tonal'
						disabled={!baseUrl.trim()}
						onPress={() => void handleSaveConfig()}
					>{t('設定を保存')}</Button>
				</View>
				<Button
					mode='contained'
					icon='cloud-upload'
					loading={cloudBackupMutation.isPending}
					disabled={!baseUrl.trim() || cloudBackupMutation.isPending}
					onPress={() =>
						cloudBackupMutation.mutate(
							{ config: currentConfig(), password },
							{
								onSuccess: () => {
									void refetchBackups({ throwOnError: true }).catch((error) =>
										toastAndLogError(
											t('クラウドバックアップの読み込みに失敗しました'),
											error,
											'UI.Settings.Backup',
										),
									)
								},
							},
						)
					}
					style={styles.primaryButton}
				>{t('今すぐクラウドにバックアップ')}</Button>

				<View style={styles.listHeader}>
					<Text variant='titleMedium'>{t('クラウドバックアップ')}</Text>
					<IconButton
						icon='refresh'
						size={20}
						loading={isRefreshing}
						disabled={!baseUrl.trim() || isRefreshing}
						onPress={() => void handleRefreshBackups()}
					/>
				</View>
				{(entries?.length ?? 0) === 0 ? (
					<Text
						variant='bodyMedium'
						style={{ color: colors.onSurfaceVariant }}
					>{t('クラウドバックアップはありません')}</Text>
				) : (
					entries?.map((entry) => (
						<List.Item
							key={entry.path}
							title={formatBackupDate(entry)}
							description={`${formatBytes(entry.size)} · ${entry.name}`}
							left={(props) => (
								<List.Icon
									{...props}
									icon='cloud-check'
								/>
							)}
							right={() => (
								<IconButton
									icon='cloud-download'
									size={20}
									loading={
										cloudRestoreMutation.isPending &&
										cloudRestoreMutation.variables?.entry.path === entry.path
									}
									disabled={cloudRestoreMutation.isPending}
									onPress={() =>
										confirmCloudRestore(entry, (selectedEntry) =>
											cloudRestoreMutation.mutate({
												config: currentConfig(),
												password,
												entry: selectedEntry,
											}),
										)
									}
								/>
							)}
						/>
					))
				)}
			</ScrollView>
		</View>
	)
}

function confirmCloudRestore(
	entry: WebDavEntry,
	restore: (entry: WebDavEntry) => void,
) {
	alert(t('クラウドバックアップを復元'), t('復元すると、現在のデータが上書きされます。続けますか？'), [
		{ text: t('キャンセル') },
		{ text: t('復元'), onPress: () => restore(entry) },
	])
}

function showRestartPrompt() {
	alert(t('復元が完了しました'), t('復元しました。再起動しますか？'), [
		{ text: t('あとで') },
		{ text: t('今すぐ再起動'), onPress: () => void Expo.reloadAppAsync() },
	])
}

function formatBackupDate(entry: WebDavEntry): string {
	return entry.lastModified?.toLocaleString() ?? t('日時不明')
}

function formatBytes(size: number): string {
	if (size < 1024) return `${size} B`
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
	return `${(size / 1024 / 1024).toFixed(1)} MB`
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	scrollView: { flex: 1 },
	scrollContent: { paddingHorizontal: 20 },
	input: { marginTop: 10 },
	buttonRow: {
		flexDirection: 'row',
		gap: 12,
		marginTop: 12,
	},
	primaryButton: { marginTop: 16 },
	divider: { marginTop: 24 },
	listHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 24,
	},
})
