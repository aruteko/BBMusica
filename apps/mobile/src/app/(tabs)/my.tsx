import dayjs from 'dayjs'
import { Image } from 'expo-image'
import { useObserve } from 'expo-observe'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Icon, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import NativeTabPage from '@/components/NativeTabPage'
import SkinAppbarBackground from '@/components/navigation/SkinAppbarBackground'
import ListeningRecordSection from '@/features/profile/ListeningRecordSection'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import useSkinForegroundColor from '@/hooks/theme/useSkinForegroundColor'
import { markPerfInteractive } from '@/lib/performance'
import { t } from '@/i18n'

function MyPageContent() {
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const { width, height } = useWindowDimensions()
	const compact = width < 360 || height < 700
	const router = useRouter()
	const haveTrack = useCurrentTrack()
	const hideStarPrompt = useAppStore((state) => state.settings.hideStarPrompt)
	const openModal = useModalStore((state) => state.open)
	const headerForegroundColor = useSkinForegroundColor()
	const hasCookie = useAppStore((state) => state.hasBilibiliCookie())
	const cachedProfile = useAppStore((state) => state.bilibiliUserInfo)
	const { data: personalInfo } = usePersonalInformation()
	const profile = hasCookie ? (personalInfo ?? cachedProfile) : undefined
	const activeSkin = useActiveSkin()
	const avatarFrameIndex = useSkinStore((state) => state.activeAvatarFrameIndex)
	const avatarFrame = activeSkin?.avatarFrames[avatarFrameIndex]
	const { markInteractive } = useObserve()
	useEffect(() => {
		markInteractive()
		void markPerfInteractive()
	}, [markInteractive])
	const chevron = () => (
		<Icon
			source='chevron-right'
			size={24}
			color={colors.onSurfaceVariant}
		/>
	)

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<SkinAppbarBackground height={insets.top + 100} />
			<View
				style={[
					styles.header,
					compact && { paddingBottom: 4 },
					{ paddingTop: insets.top + 8 },
				]}
			>
				<Text
					variant='headlineSmall'
					style={[styles.bold, { color: headerForegroundColor }]}
				>{t('マイページ')}</Text>
				<View style={styles.headerActions}>
					{!hideStarPrompt && (
						<IconButton
							icon='star-outline'
							accessibilityLabel={t('GitHubでStarを付ける')}
							iconColor={headerForegroundColor}
							onPress={() => openModal('StarPrompt', undefined)}
						/>
					)}
					<IconButton
						icon='cog-outline'
						accessibilityLabel={t('設定')}
						testID='profile-settings'
						iconColor={headerForegroundColor}
						onPress={() => router.navigate('/settings')}
					/>
				</View>
			</View>
			<ScrollView
				contentContainerStyle={[
					styles.content,
					{ paddingBottom: haveTrack ? 86 : 24 },
				]}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.accounts}>
					<Touchable
						accessibilityRole='button'
						accessibilityLabel={
							hasCookie ? t('Bilibiliアカウントを管理') : t('Bilibiliアカウントにログイン')
						}
						style={[styles.profile, compact && styles.compactProfile]}
						onPress={() => router.navigate('/settings/bilibili-account')}
					>
						<View
							style={[
								styles.avatarWrapper,
								compact && { width: 48, height: 48 },
							]}
						>
							<Image
								style={[
									styles.avatar,
									compact && { width: 48, height: 48, borderRadius: 24 },
								]}
								source={
									profile?.face
										? { uri: profile.face }
										: require('../../../assets/images/bilibili-default-avatar.jpg')
								}
								cachePolicy='disk'
							/>
							{avatarFrame && (
								<Image
									source={avatarFrame}
									style={[
										styles.avatarFrame,
										compact && { width: 64, height: 64 },
									]}
									contentFit='contain'
									cachePolicy='memory-disk'
								/>
							)}
						</View>
						<View style={[styles.profileText, compact && { gap: 2 }]}>
							<Text
								variant={compact ? 'titleMedium' : 'titleLarge'}
								style={styles.bold}
								numberOfLines={1}
							>
								{hasCookie
									? (profile?.name ?? t('Bilibiliユーザー'))
									: t('Bilibiliにログイン')}
							</Text>
							<Text
								variant='bodyMedium'
								style={{ color: colors.onSurfaceVariant }}
							>
								{hasCookie
									? t('Bilibiliアカウント')
									: t('ログインするとお気に入り、フォロー、あとで見るを使えます')}
							</Text>
						</View>
						{chevron()}
					</Touchable>
				</View>
				<ListeningRecordSection compact={compact} />
				<SettingsSectionTitle
					title={t('マイコンテンツ')}
					first
				/>
				<View>
					<List.Item
						title={t('よく聴いている曲')}
						left={(props) => (
							<List.Icon
								{...props}
								icon='history'
							/>
						)}
						right={chevron}
						onPress={() => router.navigate('/playlist/recently')}
					/>
					<List.Item
						title={t('フォロー中')}
						left={(props) => (
							<List.Icon
								{...props}
								icon='account-heart-outline'
							/>
						)}
						right={chevron}
						onPress={() => router.navigate('/following')}
					/>
					<List.Item
						title={t('ダウンロード')}
						left={(props) => (
							<List.Icon
								{...props}
								icon='download-box-outline'
							/>
						)}
						right={chevron}
						onPress={() => router.navigate('/downloaded')}
					/>
					<List.Item
						title={t('あとで見る')}
						left={(props) => (
							<List.Icon
								{...props}
								icon='clock-outline'
							/>
						)}
						right={chevron}
						onPress={() =>
							router.navigate(
								hasCookie
									? '/playlist/remote/toview'
									: '/settings/bilibili-account',
							)
						}
					/>
					<List.Item
						title={t('あの月の今日')}
						left={(props) => (
							<List.Icon
								{...props}
								icon='calendar-month-outline'
							/>
						)}
						right={chevron}
						onPress={() =>
							router.navigate(
								`/history/${dayjs().subtract(1, 'month').format('YYYY-MM-DD')}`,
							)
						}
					/>
				</View>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	header: {
		paddingHorizontal: 16,
		paddingBottom: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headerActions: { flexDirection: 'row', alignItems: 'center' },
	content: { paddingHorizontal: 16 },
	bold: { fontWeight: 'bold' },
	accounts: { paddingBottom: 8 },
	accountBar: {
		minHeight: 48,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 12,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	accountStatus: { flex: 1, textAlign: 'right' },
	compactProfile: { minHeight: 72, paddingVertical: 8, gap: 12 },
	profile: {
		paddingVertical: 16,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
		minHeight: 104,
	},
	profileText: { flex: 1, gap: 6 },
	avatarWrapper: {
		width: 64,
		height: 64,
		alignItems: 'center',
		justifyContent: 'center',
	},
	avatar: { width: 64, height: 64, borderRadius: 32 },
	avatarFrame: { position: 'absolute', width: 86, height: 86 },
})

export default function MyPage() {
	return (
		<NativeTabPage>
			<MyPageContent />
		</NativeTabPage>
	)
}
