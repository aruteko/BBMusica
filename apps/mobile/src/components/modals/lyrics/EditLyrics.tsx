import { verify } from '@bbplayer/splash'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Dialog, TextInput, useTheme } from 'react-native-paper'
import { TabBar, TabView } from 'react-native-tab-view'

import Button from '@/components/common/Button'
import { alert } from '@/components/modals/AlertModal'
import { lyricsQueryKeys } from '@/hooks/queries/lyrics'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import type { LyricFileData } from '@/types/player/lyrics'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'
import { t } from '@/i18n'

export default function EditLyricsModal({
	uniqueKey,
	lyrics,
}: {
	uniqueKey: string
	lyrics: LyricFileData
}) {
	const close = useModalStore((state) => state.close)
	const theme = useTheme()

	const [lrc, setLrc] = useState(lyrics.lrc ?? '')
	const [tlyric, setTlyric] = useState(lyrics.tlyric ?? '')
	const [romalrc, setRomalrc] = useState(lyrics.romalrc ?? '')

	const [index, setIndex] = useState(0)
	const [routes] = useState([
		{ key: 'lrc', title: t('メイン歌詞') },
		{ key: 'tlyric', title: t('翻訳') },
		{ key: 'romalrc', title: t('ローマ字') },
	])

	const renderScene = ({ route }: { route: { key: string } }) => {
		switch (route.key) {
			case 'lrc':
				return (
					<View style={styles.inputContainer}>
						<TextInput
							label={t('メイン歌詞')}
							value={lrc}
							onChangeText={setLrc}
							mode='outlined'
							multiline
							style={styles.textInput}
							textAlignVertical='top'
							placeholder={t('LRC形式の歌詞を入力')}
						/>
					</View>
				)
			case 'tlyric':
				return (
					<View style={styles.inputContainer}>
						<TextInput
							label={t('翻訳')}
							value={tlyric}
							onChangeText={setTlyric}
							mode='outlined'
							multiline
							style={styles.textInput}
							textAlignVertical='top'
							placeholder={t('翻訳の歌詞を入力')}
						/>
					</View>
				)
			case 'romalrc':
				return (
					<View style={styles.inputContainer}>
						<TextInput
							label={t('ローマ字')}
							value={romalrc}
							onChangeText={setRomalrc}
							mode='outlined'
							multiline
							style={styles.textInput}
							textAlignVertical='top'
							placeholder={t('ローマ字の歌詞を入力')}
						/>
					</View>
				)
			default:
				return null
		}
	}

	const saveLyrics = async () => {
		const newLyricData: LyricFileData = {
			...lyrics,
			lrc,
			tlyric: tlyric || undefined,
			romalrc: romalrc || undefined,
			updateTime: Date.now(),
			manualSkip: false,
			errorMessage: undefined,
		}

		const result = await lyricService.saveLyricsToFile(newLyricData, uniqueKey)

		if (result.isErr()) {
			toastAndLogError(
				t('歌詞の保存に失敗しました'),
				result.error,
				'Components.EditLyricsModal',
			)
			return
		}

		queryClient.setQueryData(
			lyricsQueryKeys.smartFetchLyrics(uniqueKey),
			result.value,
		)
		toast.success(t('歌詞を保存しました'))
		close('EditLyrics')
	}

	const handleConfirm = async () => {
		const result = verify(lrc)
		if (result.isValid) {
			await saveLyrics()
		} else {
			alert(
				t('歌詞の形式が正しくありません'),
				`${result.error.line}${t(' 行目にエラーがあります: ')}${result.error.message}`,
				[
					{
						text: t('キャンセル'),
						onPress: () => {
							// do nothing
						},
					},
					{
						text: t('このまま保存'),
						onPress: saveLyrics,
						afterModalHostClosed: false,
					},
				],
			)
		}
	}

	const clearLyrics = () => {
		alert(
			t('歌詞を消去しますか？'),
			t('消去すると、この曲の歌詞は表示されません'),
			[
				{ text: t('キャンセル') },
				{
					text: t('消去'),
					afterModalHostClosed: false,
					onPress: async () => {
						const result = await lyricService.skipLyric(uniqueKey)
						if (result.isErr()) {
							toastAndLogError(
								t('歌詞の消去に失敗しました'),
								result.error,
								'Components.EditLyricsModal',
							)
							return
						}

						queryClient.setQueryData(
							lyricsQueryKeys.smartFetchLyrics(uniqueKey),
							{
								...result.value,
								lrc: undefined,
								tlyric: undefined,
								romalrc: undefined,
								manualSkip: true,
								errorMessage: t('歌詞の取得をスキップしましたが、再検索や編集はできます'),
								misc: undefined,
							},
						)
						toast.success(t('歌詞を消去しました'))
						close('EditLyrics')
					},
				},
			],
		)
	}

	return (
		<>
			<Dialog.Title>{t('歌詞を編集')}</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<View style={styles.header}>
					<Text style={{ color: theme.colors.onSurfaceVariant }}>{t('SPL形式に従います')}</Text>
					<Text
						style={{
							color: theme.colors.primary,
							textDecorationLine: 'underline',
						}}
						onPress={() =>
							WebBrowser.openBrowserAsync(
								'https://moriafly.com/standards/spl.html',
							)
						}
					>{t('タップして仕様の詳細を見る')}</Text>
				</View>
				<TabView
					navigationState={{ index, routes }}
					renderTabBar={(props) => (
						<TabBar
							style={{
								backgroundColor: theme.colors.background,
							}}
							indicatorStyle={{
								backgroundColor: theme.colors.onSecondaryContainer,
							}}
							activeColor={theme.colors.onSecondaryContainer}
							inactiveColor={theme.colors.onSurface}
							{...props}
						/>
					)}
					renderScene={renderScene}
					onIndexChange={setIndex}
					style={styles.tabView}
				/>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={clearLyrics}>{t('歌詞を消去')}</Button>
				<Button onPress={() => close('EditLyrics')}>{t('キャンセル')}</Button>
				<Button onPress={handleConfirm}>OK</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 0,
		paddingBottom: 0,
		marginBottom: 8,
		height: 350,
	},
	header: {
		paddingHorizontal: 24,
		paddingBottom: 12,
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	tabView: {
		flex: 1,
	},
	inputContainer: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 10,
	},
	textInput: {
		flex: 1,
		fontSize: 14,
	},
})
