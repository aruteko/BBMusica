import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Avatar,
	Divider,
	List,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { queryClient } from '@/lib/config/queryClient'
import toast from '@/utils/toast'

export default function BilibiliAccountSettingsPage() {
	const router = useRouter()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const openModal = useModalStore((state) => state.open)
	const hasBilibiliCookie = useAppStore((state) => state.hasBilibiliCookie())
	const cachedUserInfo = useAppStore((state) => state.bilibiliUserInfo)
	const clearBilibiliCookie = useAppStore((state) => state.clearBilibiliCookie)
	const sendPlayHistory = useAppStore((state) => state.settings.sendPlayHistory)
	const setSettings = useAppStore((state) => state.setSettings)
	const { data: personalInfo } = usePersonalInformation()
	const profile = personalInfo ?? cachedUserInfo
	const activeSkin = useActiveSkin()
	const activeAvatarFrameIndex = useSkinStore(
		(state) => state.activeAvatarFrameIndex,
	)

	const clearAccount = () => {
		alert(
			'Bilibiliアカウントからログアウトしますか？',
			'ログアウトすると、お気に入り、あとで見る、再生履歴の送信などの機能が停止します。',
			[
				{ text: 'キャンセル' },
				{
					text: 'OK',
					onPress: async () => {
						clearBilibiliCookie()
						await queryClient.cancelQueries()
						queryClient.clear()
						toast.success('Bilibiliアカウントからログアウトしました')
					},
				},
			],
			{ cancelable: true },
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='Bilibiliアカウント' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 90 : 24) },
				]}
			>
				{hasBilibiliCookie ? (
					<>
						<SettingsSectionTitle
							title='プロフィール'
							first
						/>
						<Surface
							mode='flat'
							style={[
								styles.profileCard,
								{ backgroundColor: colors.surfaceVariant },
							]}
						>
							<View style={styles.avatarWrapper}>
								{profile?.face ? (
									<Image
										source={{ uri: profile.face }}
										style={styles.profileImage}
										cachePolicy='disk'
									/>
								) : (
									<Avatar.Image
										size={72}
										source={require('../../../../assets/images/bilibili-default-avatar.jpg')}
									/>
								)}
								{activeSkin?.avatarFrames[activeAvatarFrameIndex] ? (
									<Image
										source={activeSkin.avatarFrames[activeAvatarFrameIndex]}
										style={styles.avatarFrame72}
										contentFit='contain'
										cachePolicy='memory-disk'
									/>
								) : null}
							</View>
							<View style={styles.profileText}>
								<Text
									variant='titleLarge'
									numberOfLines={1}
								>
									{profile?.name ?? 'Bilibili 用户'}
								</Text>
								<Text
									variant='bodyMedium'
									style={{ color: colors.onSurfaceVariant }}
									numberOfLines={1}
								>
									{profile?.mid ? `UID ${profile.mid}` : 'Cookieを保存済み'}
								</Text>
							</View>
						</Surface>
						<SettingsSectionTitle title='プライバシー' />
						<View style={styles.section}>
							<View style={styles.settingRow}>
								<View style={styles.settingText}>
									<Text variant='bodyLarge'>視聴の進み具合を送信</Text>
									<Text
										variant='bodySmall'
										style={{ color: colors.onSurfaceVariant }}
									>
										Bilibiliの曲を再生するときに、視聴履歴を同期します
									</Text>
								</View>
								<UniversalSwitch
									value={sendPlayHistory}
									onValueChange={() =>
										setSettings({ sendPlayHistory: !sendPlayHistory })
									}
								/>
							</View>
						</View>
						<SettingsSectionTitle title='ログイン方法' />
						<View style={styles.section}>
							<List.Item
								title='QRコードで再ログイン'
								description='Cookieが無効になったときの再認証に'
								left={(props) => (
									<List.Icon
										{...props}
										icon='qrcode-scan'
									/>
								)}
								right={(props) => (
									<List.Icon
										{...props}
										icon='chevron-right'
									/>
								)}
								onPress={() =>
									router.navigate('/settings/bilibili-account/qrcode-login')
								}
							/>
							<Divider />
							<List.Item
								title='電話番号でログイン'
								description='SMSの認証コードでBilibiliにログインします'
								left={(props) => (
									<List.Icon
										{...props}
										icon='cellphone-key'
									/>
								)}
								right={(props) => (
									<List.Icon
										{...props}
										icon='chevron-right'
									/>
								)}
								onPress={() =>
									router.navigate('/settings/bilibili-account/phone-login')
								}
							/>
							<Divider />
							<List.Item
								title='Cookieを編集'
								description='BilibiliのCookieを手動で貼り付け、または消去します'
								left={(props) => (
									<List.Icon
										{...props}
										icon='cookie'
									/>
								)}
								right={(props) => (
									<List.Icon
										{...props}
										icon='chevron-right'
									/>
								)}
								onPress={() => openModal('CookieLogin', undefined)}
							/>
						</View>
						<Button
							mode='outlined'
							onPress={clearAccount}
						>
							Bilibiliアカウントからログアウト
						</Button>
					</>
				) : (
					<>
						<View style={styles.loginHero}>
							<View style={styles.avatarWrapper}>
								<Avatar.Image
									size={72}
									source={require('../../../../assets/images/bilibili-default-avatar.jpg')}
								/>
								{activeSkin?.avatarFrames[activeAvatarFrameIndex] ? (
									<Image
										source={activeSkin.avatarFrames[activeAvatarFrameIndex]}
										style={styles.avatarFrame72}
										contentFit='contain'
										cachePolicy='memory-disk'
									/>
								) : null}
							</View>
							<View style={styles.loginHeroText}>
								<Text variant='headlineSmall'>Bilibiliに接続</Text>
								<Text
									variant='bodyMedium'
									style={{ color: colors.onSurfaceVariant }}
								>
									ログインすると、お気に入りやあとで見るの読み込み、再生履歴の送信、アカウントが必要な内容の閲覧ができます。
								</Text>
							</View>
						</View>
						<SettingsSectionTitle title='ログイン方法' />
						<View style={styles.loginActions}>
							<Button
								mode='contained'
								icon='qrcode-scan'
								onPress={() =>
									router.navigate('/settings/bilibili-account/qrcode-login')
								}
							>
								QRコードでログイン
							</Button>
							<Button
								mode='outlined'
								icon='cellphone-key'
								onPress={() =>
									router.navigate('/settings/bilibili-account/phone-login')
								}
							>
								電話番号でログイン
							</Button>
							<Button
								mode='outlined'
								icon='cookie'
								onPress={() => openModal('CookieLogin', undefined)}
							>
								Cookieを追加
							</Button>
						</View>
					</>
				)}
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
	profileCard: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
		borderRadius: 8,
		padding: 18,
	},
	profileImage: {
		width: 72,
		height: 72,
		borderRadius: 36,
	},
	avatarWrapper: {
		position: 'relative',
		width: 72,
		height: 72,
	},
	avatarFrame72: {
		position: 'absolute',
		top: -12,
		left: -12,
		width: 96,
		height: 96,
	},
	profileText: {
		flex: 1,
		gap: 4,
	},
	section: {
		borderRadius: 8,
		overflow: 'hidden',
	},
	settingRow: {
		minHeight: 72,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		gap: 16,
	},
	settingText: {
		flex: 1,
		gap: 2,
	},
	loginHero: {
		alignItems: 'center',
		gap: 16,
		paddingTop: 24,
	},
	loginHeroText: {
		alignItems: 'center',
		gap: 8,
	},
	loginActions: {
		gap: 12,
	},
})
