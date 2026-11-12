import { SegmentedControl } from '@expo/ui/community/segmented-control'
import { Asset } from 'expo-asset'
import { Image } from 'expo-image'
import * as MediaLibrary from 'expo-media-library'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
/* oxlint-disable @typescript-eslint/no-unsafe-argument */
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'

// oxlint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const WECHAT_QR = require('../../../../assets/images/wechat.png')
// oxlint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const ALIPAY_QR = require('../../../../assets/images/alipay.jpg')

type DonationType = 'wechat' | 'alipay'

export default function DonationQRModal({
	type: initialType,
}: {
	type: DonationType
}) {
	const close = useModalStore((state) => state.close)
	const [currentType, setCurrentType] = useState<DonationType>(initialType)
	const [permissionResponse, requestPermission] = MediaLibrary.usePermissions()

	const handleLongPress = async () => {
		const needsPermission = permissionResponse?.granted

		try {
			if (needsPermission) {
				const { granted } = await requestPermission()
				if (!granted) {
					toast.error('画像を保存できません', {
						description: '設定でアルバムへのアクセスを許可してください',
					})
					return
				}
			}

			let qrAsset = ALIPAY_QR
			if (currentType === 'wechat') {
				qrAsset = WECHAT_QR
			}
			const asset = Asset.fromModule(qrAsset)
			if (!asset.downloaded) {
				await asset.downloadAsync()
			}

			let uri = asset.localUri
			if (!uri) {
				uri = asset.uri
			}

			if (!uri) {
				toast.error('保存に失敗しました', { description: '画像のパスを取得できません' })
				return
			}

			await MediaLibrary.Asset.create(uri)
			toast.success('アルバムに保存しました')
		} catch (e) {
			toast.error('保存に失敗しました', { description: String(e) })
		}
	}

	const qrImage = currentType === 'wechat' ? WECHAT_QR : ALIPAY_QR
	const title = currentType === 'wechat' ? 'WeChat Pay' : 'Alipay'

	return (
		<>
			<Dialog.Title style={{ textAlign: 'center' }}>{title}</Dialog.Title>
			<Dialog.Content>
				<View style={styles.tabContainer}>
					<SegmentedControl
						selectedIndex={currentType === 'wechat' ? 0 : 1}
						onChange={(event) => {
							const selectedIndex = event.nativeEvent.selectedSegmentIndex
							setCurrentType(selectedIndex === 0 ? 'wechat' : 'alipay')
						}}
						values={['WeChat Pay', 'Alipay']}
					/>
				</View>
				<View style={styles.imageContainer}>
					<Pressable
						onLongPress={handleLongPress}
						delayLongPress={500}
					>
						<SquircleView
							style={styles.image}
							cornerSmoothing={0.6}
						>
							<Image
								// oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment
								source={qrImage}
								style={styles.imageInner}
								contentFit='contain'
							/>
						</SquircleView>
						<Text
							variant='bodySmall'
							style={styles.hint}
						>
							長押しで支払い用QRコードを保存
						</Text>
					</Pressable>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('DonationQR')}>閉じる</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	tabContainer: {
		marginBottom: 20,
	},
	imageContainer: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	image: {
		width: 200,
		height: 200,
		backgroundColor: '#f0f0f0',
		marginBottom: 10,
		borderRadius: 44,
		overflow: 'hidden',
	},
	imageInner: {
		width: 200,
		height: 200,
	},
	hint: {
		textAlign: 'center',
		opacity: 0.6,
	},
})
