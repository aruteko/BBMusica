import Icon from '@react-native-vector-icons/material-design-icons'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import {
	useEnableSharing,
	useRotateEditorInviteCode,
} from '@/hooks/mutations/db/playlist'
import { useEditorInviteCode } from '@/hooks/queries/db/playlist'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'

const SHARE_BASE_URL = 'https://bbplayer.roitium.com/share/playlist'

export default function EnableSharingModal({
	playlistId,
	shareId: initialShareId,
	shareRole,
}: {
	playlistId: number
	shareId?: string | null
	shareRole?: 'owner' | 'editor' | 'subscriber' | null
}) {
	const router = useRouter()
	const close = useModalStore((state) => state.close)
	const doAfterModalHostClosed = useModalStore(
		(state) => state.doAfterModalHostClosed,
	)
	const { mutate: enableSharing, isPending } = useEnableSharing()
	const { mutateAsync: rotateInvite, isPending: isRotating } =
		useRotateEditorInviteCode()
	const [shareId, setShareId] = useState<string | null>(initialShareId ?? null)
	const [inviteCode, setInviteCode] = useState<string | null>(null)
	const hasToken = useAppStore((state) => !!state.bbplayerToken)

	const { data: fetchedInviteCode, isFetching: inviteFetching } =
		useEditorInviteCode(shareId)

	const subscribeUrl = shareId
		? `${SHARE_BASE_URL}?shareId=${encodeURIComponent(shareId)}`
		: ''
	const editorUrl = shareId
		? `${subscribeUrl}${inviteCode ? `&inviteCode=${encodeURIComponent(inviteCode)}` : ''}`
		: ''

	useEffect(() => {
		if (fetchedInviteCode) setInviteCode(fetchedInviteCode)
	}, [fetchedInviteCode])

	const handleConfirm = () => {
		if (!hasToken) {
			doAfterModalHostClosed(() => {
				router.navigate({
					pathname: '/settings/account',
					params: { returnTo: `/playlist/local/${playlistId}` },
				})
			})
			close('EnableSharing')
			return
		}
		enableSharing(
			{ playlistId },
			{ onSuccess: ({ shareId: id }) => setShareId(id) },
		)
	}

	const handleCopySubscribe = async () => {
		if (!subscribeUrl) return
		await Clipboard.setStringAsync(subscribeUrl)
		toast.success('購読用リンクをコピーしました')
	}

	const handleCopyEditorLink = async () => {
		if (!editorUrl || !inviteCode) return
		await Clipboard.setStringAsync(editorUrl)
		toast.success('共同編集用リンクをコピーしました')
	}

	const handleRotateInvite = async () => {
		if (!shareId) return
		if (!hasToken) {
			toast.error('先にBBPlayerアカウントにログインしてください')
			doAfterModalHostClosed(() => {
				router.navigate({
					pathname: '/settings/account',
					params: { returnTo: `/playlist/local/${playlistId}` },
				})
			})
			close('EnableSharing')
			return
		}
		const result = await rotateInvite({ shareId })
		setInviteCode(result.editorInviteCode)
		toast.success('新しい編集者の招待コードを作成しました')
	}

	const handleCopyInvite = async () => {
		if (!inviteCode) return
		await Clipboard.setStringAsync(inviteCode)
		toast.success('招待コードをコピーしました')
	}

	// ---- 成功状态：显示可复制的链接 ----
	if (shareId) {
		return (
			<>
				<Dialog.Title>共有をオンにしました 🎉</Dialog.Title>
				<Dialog.Content>
					<View style={styles.body}>
						<Text variant='bodyMedium'>
							下のリンクを友達に送ると、このプレイリストを購読できます。
						</Text>
						<View style={styles.linkSection}>
							<Text variant='bodySmall'>購読用リンク（閲覧のみ）</Text>
							<TextInput
								value={subscribeUrl}
								editable={false}
								mode='outlined'
								dense
								style={styles.linkInput}
								right={
									<TextInput.Icon
										icon='content-copy'
										onPress={handleCopySubscribe}
									/>
								}
							/>
						</View>
						{(!shareRole || shareRole === 'owner') && (
							<View style={styles.inviteSection}>
								<Text variant='bodyMedium'>
									共同編集者にこのプレイリストを編集してもらうには、下の招待リンクを使ってください。
								</Text>
								{inviteCode && (
									<View style={styles.linkSection}>
										<Text variant='bodySmall'>共同編集の招待リンク</Text>
										<TextInput
											value={editorUrl}
											editable={false}
											mode='outlined'
											dense
											style={styles.linkInput}
											right={
												<TextInput.Icon
													icon='content-copy'
													onPress={handleCopyEditorLink}
												/>
											}
										/>
									</View>
								)}
								{!inviteCode && inviteFetching && (
									<Text
										variant='bodySmall'
										style={{ textAlign: 'center' }}
									>
										招待コードを読み込み中...
									</Text>
								)}
								<Button
									onPress={handleRotateInvite}
									loading={isRotating}
									disabled={isRotating || inviteFetching}
								>
									{inviteCode ? '共同編集の招待リンクをリセット' : '共同編集の招待リンクを作成'}
								</Button>
							</View>
						)}
					</View>
				</Dialog.Content>
				<Dialog.Actions>
					<Button
						onPress={() => close('EnableSharing')}
						mode='text'
					>
						完了
					</Button>
				</Dialog.Actions>
			</>
		)
	}

	// ---- 确认状态 ----
	return (
		<>
			<Dialog.Title>プレイリストの共有をオンにする</Dialog.Title>
			<Dialog.Content>
				<View style={styles.body}>
					{!hasToken && (
						<View style={styles.warningBox}>
							<Icon
								name='alert-circle-outline'
								size={16}
								style={styles.warningIcon}
							/>
							<Text
								variant='bodySmall'
								style={styles.warningText}
							>
								共有をオンにするには、BBPlayerアカウントへのログインが必要です。
							</Text>
						</View>
					)}
					<Text variant='bodyMedium'>
						{inviteCode && (
							<TextInput
								value={inviteCode}
								editable={false}
								mode='outlined'
								dense
								style={styles.linkInput}
								right={
									<TextInput.Icon
										icon='content-copy'
										onPress={handleCopyInvite}
									/>
								}
							/>
						)}
						共有すると、ほかのユーザーがリンクからこのプレイリストを購読できます。
					</Text>
					<Text
						variant='bodySmall'
						style={styles.irreversible}
					>
						⚠️ 現在のバージョンでは、一度共有すると取り消せません。慎重に操作してください。
					</Text>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('EnableSharing')}
					disabled={isPending}
					mode='text'
				>
					キャンセル
				</Button>
				<Button
					onPress={handleConfirm}
					loading={isPending}
					disabled={isPending}
					mode='text'
				>
					共有をオンにする
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	body: {
		gap: 12,
	},
	linkSection: {
		marginTop: 4,
		gap: 4,
	},
	linkInput: {
		fontSize: 12,
	},
	inviteSection: {
		marginTop: 8,
		gap: 8,
	},
	warningBox: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 6,
		borderRadius: 8,
		backgroundColor: 'rgba(255, 180, 0, 0.12)',
		padding: 10,
	},
	warningIcon: {
		marginTop: 1,
		color: '#c58c00',
	},
	warningText: {
		flex: 1,
		color: '#c58c00',
		lineHeight: 18,
	},
	irreversible: {
		opacity: 0.6,
	},
})
