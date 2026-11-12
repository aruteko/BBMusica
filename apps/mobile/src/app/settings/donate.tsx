import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useModalStore } from '@/hooks/stores/useModalStore'

export default function DonateSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const openModal = useModalStore((state) => state.open)
	const haveTrack = useCurrentTrack()

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='寄付で応援' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<View style={styles.introContainer}>
					<Text
						variant='bodyMedium'
						style={styles.introText}
					>
						気に入っていただけたら、開発者のRoitiumに投げ銭をお願いします！いただいた分は、
						Roitiumの食事代やゲーム代に使われます！
					</Text>
				</View>
				<List.Item
					title='WeChat Pay'
					description='タップして支払い用QRコードを表示'
					left={(props) => (
						<List.Icon
							{...props}
							icon='wechat'
						/>
					)}
					right={(props) => (
						<List.Icon
							{...props}
							icon='chevron-right'
						/>
					)}
					onPress={() => openModal('DonationQR', { type: 'wechat' })}
				/>
				<List.Item
					title='Alipay'
					description='タップして支払い用QRコードを表示'
					left={(props) => (
						<List.Icon
							{...props}
							icon='wallet'
						/>
					)}
					right={(props) => (
						<List.Icon
							{...props}
							icon='chevron-right'
						/>
					)}
					onPress={() => openModal('DonationQR', { type: 'alipay' })}
				/>
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
		paddingHorizontal: 16,
	},
	introContainer: {
		paddingHorizontal: 16,
		paddingVertical: 20,
		alignItems: 'center',
	},
	introText: {
		textAlign: 'center',
		lineHeight: 24,
		opacity: 0.8,
	},
})
