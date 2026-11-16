import { useCallback } from 'react'
import type { WebViewMessageEvent } from 'react-native-webview'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'
import { t } from '@/i18n'

interface CaptchaParams {
	token: string
	gt: string
	challenge: string
	tel: string
	cid: string
}

interface UseGeetestProps {
	captchaParams: CaptchaParams | null
	onSuccess: (captchaKey: string) => void
	onFail: (errorMsg: string) => void
	onStartRequest: () => void
}

export function useGeetest({
	captchaParams,
	onSuccess,
	onFail,
	onStartRequest,
}: UseGeetestProps) {
	const handleGeetestMessage = useCallback(
		async (event: WebViewMessageEvent) => {
			if (!captchaParams) return

			let parsed: { validate?: string; seccode?: string; challenge?: string }
			try {
				parsed = JSON.parse(event.nativeEvent.data) as typeof parsed
			} catch {
				return
			}

			const { validate, seccode, challenge } = parsed
			if (!validate || !seccode || !challenge) return

			onStartRequest()
			try {
				const smsResult = await bilibiliApi.sendPhoneLoginSms({
					tel: captchaParams.tel,
					cid: captchaParams.cid,
					token: captchaParams.token,
					challenge,
					validate,
					seccode,
				})
				if (smsResult.isErr()) {
					const errCode = smsResult.error.data.msgCode
					let errorMsg = smsResult.error.message
					if (!errorMsg) {
						errorMsg = t('認証コードの送信に失敗しました。しばらくしてからお試しください')
					}
					let isExpiredCaptcha = false
					if (errCode === 86211) {
						isExpiredCaptcha = true
					}
					if (errCode === -105) {
						isExpiredCaptcha = true
					}
					if (isExpiredCaptcha) {
						errorMsg = t('画像認証の有効期限が切れました。認証コードをもう一度取得してください')
					}
					onFail(errorMsg)
					return
				}

				onSuccess(smsResult.value.captcha_key)
				toast.success(t('認証コードを送信しました'), { id: 'phone-login-sms-sent' })
			} catch (error) {
				toastAndLogError(
					t('認証コードの送信に失敗しました'),
					error,
					'useGeetest.handleGeetestMessage',
				)
				onFail(t('認証コードの送信に失敗しました'))
			}
		},
		[captchaParams, onFail, onStartRequest, onSuccess],
	)

	return {
		handleGeetestMessage,
	}
}
