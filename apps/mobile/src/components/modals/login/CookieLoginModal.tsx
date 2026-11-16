import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Dialog, Divider, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import { favoriteListQueryKeys } from '@/hooks/queries/bilibili/favorite'
import { userQueryKeys } from '@/hooks/queries/bilibili/user'
import useAppStore, { serializeCookieObject } from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'
import { t } from '@/i18n'

export default function CookieLoginModal() {
	const queryClient = useQueryClient()
	const cookieObjectFromStore = useAppStore((state) => state.bilibiliCookie)
	const setBilibiliCookie = useAppStore((state) => state.setBilibiliCookie)
	const clearBilibiliCookie = useAppStore((state) => state.clearBilibiliCookie)
	const modalClose = useModalStore((state) => state.close)
	const close = useCallback(() => modalClose('CookieLogin'), [modalClose])

	const displayCookieString = useMemo(() => {
		if (!cookieObjectFromStore) return ''
		return serializeCookieObject(cookieObjectFromStore)
	}, [cookieObjectFromStore])

	const [inputCookie, setInputCookie] = useState(displayCookieString)
	const [isLoading, setIsLoading] = useState(false)

	const handleConfirm = async () => {
		setIsLoading(true)
		const cookie = inputCookie?.trim()
		try {
			if (!cookie) {
				clearBilibiliCookie()
				await queryClient.cancelQueries()
				queryClient.clear()
				toast.success(t('Cookieを消去しました'))
				close()
				setIsLoading(false)
				return
			}

			if (inputCookie === displayCookieString) {
				close()
				setIsLoading(false)
				return
			}

			const result = setBilibiliCookie(inputCookie)
			if (result.isErr()) {
				toast.error(result.error.message)
				setIsLoading(false)
				return
			}
			toast.success(t('Cookieを更新しました'))
			await queryClient.cancelQueries()
			await queryClient.invalidateQueries({
				queryKey: favoriteListQueryKeys.all,
			})
			await queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
			close()
		} catch (error) {
			toastAndLogError(t('操作に失敗しました'), error, 'Components.CookieLoginModal')
		}
		setIsLoading(false)
	}

	const handleDismiss = () => {
		if (isLoading) return
		close()
	}

	return (
		<>
			<Dialog.Title>{t('BilibiliのCookieを設定')}</Dialog.Title>
			<Dialog.Content>
				<TextInput
					label='Cookie'
					key={displayCookieString}
					value={inputCookie}
					onChangeText={setInputCookie}
					mode='outlined'
					numberOfLines={5}
					multiline
					style={styles.cookieInput}
					textAlignVertical='top'
					testID='cookie-input'
				/>
				<Text
					variant='bodySmall'
					style={styles.cookieDescription}
				>
					{'\u2009Bilibili\u2009Cookie\u2009'}{t('をここに貼り付けてください。')}</Text>
				<Divider style={styles.divider} />
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={handleDismiss}>{t('キャンセル')}</Button>
				<Button
					onPress={handleConfirm}
					testID='cookie-login-confirm'
				>
					OK
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	cookieInput: {
		maxHeight: 200,
	},
	cookieDescription: {
		marginTop: 8,
	},
	divider: {
		marginTop: 16,
		marginBottom: 16,
	},
})
