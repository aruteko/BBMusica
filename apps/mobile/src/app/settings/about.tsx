import * as Application from 'expo-application'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import * as Updates from 'expo-updates'
import * as WebBrowser from 'expo-web-browser'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Divider,
	List,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	GITHUB_REPO_LABEL,
	GITHUB_REPO_URL,
	WEBSITE_LABEL,
	WEBSITE_URL,
} from '@/lib/config/links'
import toast from '@/utils/toast'
import { t } from '@/i18n'
import { CORNER_RADIUS } from '@/theme/dimensions'

const openExternalLink = async (url: string) => {
	try {
		await WebBrowser.openBrowserAsync(url)
	} catch (e) {
		await Clipboard.setStringAsync(url)
		toast.error(t('ブラウザを開けないため、リンクをクリップボードにコピーしました'), {
			description: String(e),
		})
	}
}

const updateTime = Updates.createdAt
	? `${Updates.createdAt.getFullYear()}-${Updates.createdAt.getMonth() + 1}-${Updates.createdAt.getDate()}`
	: ''

export default function AboutSettingsPage() {
	const router = useRouter()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const versionText = `v${Application.nativeApplicationVersion}:${Application.nativeBuildVersion}${
		Updates.updateId
			? ` hotfix-${Updates.updateId.slice(0, 7)}-${updateTime}`
			: ''
	}`

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={t('BBMusicaについて')} />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 90 : 24) },
				]}
			>
				<Surface
					mode='flat'
					style={[styles.hero, { backgroundColor: colors.surfaceVariant }]}
				>
					<Text variant='headlineMedium'>BBMusica</Text>
					<Text
						variant='bodyLarge'
						style={{ color: colors.onSurfaceVariant }}
					>{t('もう一つのBilibili音楽プレーヤー')}</Text>
					<Text
						variant='bodySmall'
						style={{ color: colors.onSurfaceVariant }}
					>
						{versionText}
					</Text>
					<View style={styles.linkButtons}>
						<Button
							mode='contained'
							icon='web'
							onPress={() => void openExternalLink(WEBSITE_URL)}
						>{t('ウェブサイト')}</Button>
						<Button
							mode='outlined'
							icon='github'
							onPress={() => void openExternalLink(GITHUB_REPO_URL)}
						>
							GitHub
						</Button>
					</View>
				</Surface>
				<View style={styles.section}>
					<List.Item
						title='GitHub'
						description={GITHUB_REPO_LABEL}
						left={(props) => (
							<List.Icon
								{...props}
								icon='github'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='open-in-new'
							/>
						)}
						onPress={() => void openExternalLink(GITHUB_REPO_URL)}
					/>
					<Divider />
					<List.Item
						title={t('ウェブサイト')}
						description={WEBSITE_LABEL}
						left={(props) => (
							<List.Icon
								{...props}
								icon='web'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='open-in-new'
							/>
						)}
						onPress={() => void openExternalLink(WEBSITE_URL)}
					/>
				</View>
			</ScrollView>
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
		gap: 18,
		paddingHorizontal: 20,
		paddingTop: 8,
	},
	hero: {
		gap: 8,
		borderRadius: CORNER_RADIUS,
		padding: 20,
	},
	linkButtons: {
		flexDirection: 'row',
		gap: 12,
		marginTop: 8,
	},
	section: {
		borderRadius: CORNER_RADIUS,
		overflow: 'hidden',
	},
})
