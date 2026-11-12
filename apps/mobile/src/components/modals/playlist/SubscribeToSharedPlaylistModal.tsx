import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { Dialog, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** 从任意输入中提取 shareId + inviteCode（优先 query params） */
function parseShareLink(input: string): {
	shareId?: string
	inviteCode?: string
} {
	const trimmed = input.trim()
	if (!trimmed) return {}

	try {
		const url = new URL(trimmed)
		const qpShareId = url.searchParams.get('shareId') ?? undefined
		const qpInvite = url.searchParams.get('inviteCode') ?? undefined
		const pathUuid = url.pathname.match(UUID_RE)?.[0]
		return {
			shareId: qpShareId ?? pathUuid ?? undefined,
			inviteCode: qpInvite ?? undefined,
		}
	} catch (_e) {
		// fallback to plain text / raw UUID
		const uuid = trimmed.match(UUID_RE)?.[0]
		return { shareId: uuid ?? undefined, inviteCode: undefined }
	}
}

export default function SubscribeToSharedPlaylistModal() {
	const [input, setInput] = useState('')
	const [inviteCode, setInviteCode] = useState('')
	const close = useModalStore((state) => state.close)
	const router = useRouter()

	const parsed = parseShareLink(input)
	const shareId = parsed.shareId ?? ''
	const isValidId = UUID_RE.test(shareId)

	const handleSubscribe = () => {
		if (!isValidId) return
		close('SubscribeToSharedPlaylist')
		useModalStore.getState().doAfterModalHostClosed(() => {
			router.navigate({
				pathname: '/share/playlist',
				params: {
					shareId: shareId,
					inviteCode:
						(inviteCode || parsed.inviteCode || '').trim() || undefined,
				},
			})
		})
	}

	const handleChangeInput = (text: string) => {
		setInput(text)
		const next = parseShareLink(text)
		if (next.inviteCode) {
			setInviteCode(next.inviteCode)
		}
	}

	return (
		<>
			<Dialog.Title>共有プレイリストを購読</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<Text
					variant='bodyMedium'
					style={styles.hint}
				>
					相手が共有したリンクまたはプレイリストID（UUID形式）を貼り付けると購読できます。
				</Text>
				<TextInput
					label='共有リンク / プレイリストID'
					value={input}
					onChangeText={handleChangeInput}
					mode='outlined'
					autoCapitalize='none'
					autoCorrect={false}
					style={styles.input}
					error={input.trim().length > 0 && !isValidId}
				/>
				<TextInput
					label='編集者の招待コード（任意）'
					value={inviteCode}
					onChangeText={setInviteCode}
					mode='outlined'
					autoCapitalize='characters'
					autoCorrect={false}
					style={styles.input}
					placeholder={
						parsed.inviteCode ? `リンクから入力しました：${parsed.inviteCode}` : ''
					}
				/>
				{input.trim().length > 0 && !isValidId && (
					<Text
						variant='bodySmall'
						style={styles.errorText}
					>
						有効なプレイリストIDを認識できません。リンクが完全かどうか確認してください。
					</Text>
				)}
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('SubscribeToSharedPlaylist')}
					mode='text'
				>
					キャンセル
				</Button>
				<Button
					onPress={handleSubscribe}
					disabled={!isValidId}
					mode='text'
				>
					購読
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: 8,
	},
	hint: {
		opacity: 0.7,
		marginBottom: 4,
	},
	input: {
		marginTop: 4,
	},
	errorText: {
		color: '#cf6679',
		marginTop: 2,
	},
})
