import { useObserve } from 'expo-observe'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Divider, List, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'

export default function SettingsPage() {
	const insets = useSafeAreaInsets()
	const colors = useTheme().colors
	const router = useRouter()
	const { markInteractive } = useObserve()

	useEffect(() => {
		markInteractive()
	}, [markInteractive])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<View style={styles.container}>
				<Appbar.Header>
					<Appbar.BackAction onPress={() => router.back()} />
					<Appbar.Content title='設定' />
				</Appbar.Header>
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={[
						styles.scrollContent,
						{ paddingBottom: insets.bottom },
					]}
					showsVerticalScrollIndicator
					persistentScrollbar // 我看哪个 b 还说看不见这是可滚动的？！
				>
					<SettingsSectionTitle
						title='パーソナライズ'
						first
					/>
					<List.Item
						title='外観とテーマ'
						description='プレーヤーのスタイル、ダイナミックテーマ、起動アニメーション'
						left={(props) => (
							<List.Icon
								{...props}
								icon='palette'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.navigate('/settings/appearance')}
					/>
					<Divider style={styles.divider} />
					<List.Item
						title='再生'
						testID='settings-playback'
						description='再生動作、起動時の動作、サウンド効果'
						left={(props) => (
							<List.Icon
								{...props}
								icon='play-circle'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.navigate('/settings/playback')}
					/>
					<Divider style={styles.divider} />
					<List.Item
						title='CDN設定'
						description='優先CDN、ノード速度テスト'
						left={(props) => (
							<List.Icon
								{...props}
								icon='cloud-outline'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.navigate('/settings/cdn')}
					/>
					<Divider style={styles.divider} />
					<List.Item
						title='歌詞'
						description='歌詞ソース、デスクトップ歌詞、スタイル'
						left={(props) => (
							<List.Icon
								{...props}
								icon='text-box-outline'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.navigate('/settings/lyrics')}
					/>

					<SettingsSectionTitle title='ライブラリとストレージ' />
					<List.Item
						title='ダウンロードとストレージ'
						description='同時ダウンロード数、ストレージ使用量、キャッシュ削除'
						left={(props) => (
							<List.Icon
								{...props}
								icon='harddisk'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.navigate('/settings/storage')}
					/>

					<SettingsSectionTitle title='データ' />
					<List.Item
						title='データとバックアップ'
						description='ローカルバックアップ、WebDAVクラウドバックアップ'
						left={(props) => (
							<List.Icon
								{...props}
								icon='cloud-sync'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.navigate('/settings/backup')}
					/>

					<SettingsSectionTitle title='一般と情報' />
					<List.Item
						title='一般'
						description='アップデート、ログ、デバッグ'
						left={(props) => (
							<List.Icon
								{...props}
								icon='cog'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.navigate('/settings/general')}
						testID='setting-general'
					/>
					<Divider style={styles.divider} />
					<List.Item
						title='BBPlayerについて'
						description='バージョン、プロジェクトページ'
						left={(props) => (
							<List.Icon
								{...props}
								icon='information'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.navigate('/settings/about')}
					/>
					<Divider style={styles.divider} />
					<List.Item
						title='寄付で応援'
						description='開発者にコーヒーをおごる'
						left={(props) => (
							<List.Icon
								{...props}
								icon='coffee'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.navigate('/settings/donate')}
					/>
				</ScrollView>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 16,
	},
	divider: {
		marginVertical: 4,
		backgroundColor: 'transparent', // Spacer
	},
})
