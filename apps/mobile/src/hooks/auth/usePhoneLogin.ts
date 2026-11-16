import * as Sentry from '@sentry/react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useReducer } from 'react'
import * as setCookieParser from 'set-cookie-parser'

import { favoriteListQueryKeys } from '@/hooks/queries/bilibili/favorite'
import { userQueryKeys } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

import { useGeetest } from './useGeetest'
import { t } from '@/i18n'

export type Step = 'input_phone' | 'geetest_verify' | 'input_code' | 'success'

interface CaptchaParams {
	token: string
	gt: string
	challenge: string
	tel: string
	cid: string
}

const COUNTRY_CODE = '86'

export const phoneFormModel = {
	tel: {
		validate(v: string): string {
			const trimmed = v.trim()
			if (!trimmed) return t('電話番号を入力してください')
			if (!/^\d{5,15}$/.test(trimmed)) return t('電話番号の形式が正しくありません')
			return ''
		},
	},
	smsCode: {
		validate(v: string): string {
			const trimmed = v.trim()
			if (!trimmed) return t('認証コードを入力してください')
			if (!/^\d{4,8}$/.test(trimmed)) return t('認証コードの形式が正しくありません')
			return ''
		},
	},
}

type LoginStatus = 'idle' | 'loading' | 'success'

interface LoginState {
	step: Step
	status: LoginStatus
	tel: string
	smsCode: string
	captchaKey: string
	captchaParams: CaptchaParams | null
	phoneError: string
	codeError: string
}

type LoginAction =
	| { type: 'SET_TEL'; payload: string }
	| { type: 'SET_SMS_CODE'; payload: string }
	| { type: 'START_REQUEST' }
	| { type: 'SET_CAPTCHA_PARAMS'; payload: CaptchaParams }
	| { type: 'REQUEST_FAIL'; payload?: string }
	| { type: 'SET_SMS_SENT'; payload: string }
	| { type: 'LOGIN_SUCCESS' }
	| { type: 'LOGIN_FAIL'; payload: string }
	| { type: 'RESET_STEP' }
	| { type: 'SET_PHONE_ERROR'; payload: string }
	| { type: 'SET_CODE_ERROR'; payload: string }

const initialState: LoginState = {
	step: 'input_phone',
	status: 'idle',
	tel: '',
	smsCode: '',
	captchaKey: '',
	captchaParams: null,
	phoneError: '',
	codeError: '',
}

function loginReducer(state: LoginState, action: LoginAction): LoginState {
	switch (action.type) {
		case 'SET_TEL':
			return { ...state, tel: action.payload, phoneError: '' }
		case 'SET_SMS_CODE':
			return { ...state, smsCode: action.payload, codeError: '' }
		case 'START_REQUEST':
			return { ...state, status: 'loading', phoneError: '', codeError: '' }
		case 'SET_CAPTCHA_PARAMS':
			return {
				...state,
				status: 'idle',
				step: 'geetest_verify',
				captchaParams: action.payload,
			}
		case 'REQUEST_FAIL':
			return {
				...state,
				status: 'idle',
				step: 'input_phone',
				phoneError: action.payload || state.phoneError,
			}
		case 'SET_SMS_SENT':
			return {
				...state,
				status: 'idle',
				step: 'input_code',
				captchaKey: action.payload,
			}
		case 'LOGIN_SUCCESS':
			return { ...state, status: 'success', step: 'success' }
		case 'LOGIN_FAIL':
			return { ...state, status: 'idle', codeError: action.payload }
		case 'RESET_STEP':
			return {
				...state,
				step: 'input_phone',
				status: 'idle',
				smsCode: '',
				codeError: '',
				captchaKey: '',
				captchaParams: null,
			}
		case 'SET_PHONE_ERROR':
			return { ...state, phoneError: action.payload }
		case 'SET_CODE_ERROR':
			return { ...state, codeError: action.payload }
		default:
			return state
	}
}

export function usePhoneLogin(options?: { onClose?: () => void }) {
	const queryClient = useQueryClient()
	const setCookie = useAppStore((state) => state.updateBilibiliCookie)
	const onClose = options?.onClose
	const close = useCallback(() => {
		onClose?.()
	}, [onClose])

	const [state, dispatch] = useReducer(loginReducer, initialState)

	const { handleGeetestMessage } = useGeetest({
		captchaParams: state.captchaParams,
		onStartRequest: () => dispatch({ type: 'START_REQUEST' }),
		onSuccess: (captchaKey) =>
			dispatch({ type: 'SET_SMS_SENT', payload: captchaKey }),
		onFail: (errorMsg) => dispatch({ type: 'REQUEST_FAIL', payload: errorMsg }),
	})

	const handleRequestCode = async () => {
		const telError = phoneFormModel.tel.validate(state.tel)
		if (telError) {
			dispatch({ type: 'SET_PHONE_ERROR', payload: telError })
			return
		}

		dispatch({ type: 'START_REQUEST' })
		try {
			const captchaResult = await bilibiliApi.getPhoneLoginCaptchaToken()
			if (captchaResult.isErr()) {
				toastAndLogError(
					t('認証コードの取得に失敗しました'),
					captchaResult.error,
					'usePhoneLogin.getPhoneLoginCaptchaToken',
				)
				dispatch({ type: 'REQUEST_FAIL' })
				return
			}
			const captcha = captchaResult.value
			dispatch({
				type: 'SET_CAPTCHA_PARAMS',
				payload: {
					token: captcha.token,
					gt: captcha.geetest.gt,
					challenge: captcha.geetest.challenge,
					tel: state.tel.trim(),
					cid: COUNTRY_CODE,
				},
			})
		} catch (error) {
			toastAndLogError(
				t('認証コードの取得に失敗しました'),
				error,
				'usePhoneLogin.handleRequestCode',
			)
			dispatch({ type: 'REQUEST_FAIL' })
		}
	}

	const handleLogin = async () => {
		const codeErr = phoneFormModel.smsCode.validate(state.smsCode)
		if (codeErr) {
			dispatch({ type: 'SET_CODE_ERROR', payload: codeErr })
			return
		}

		dispatch({ type: 'START_REQUEST' })
		try {
			const loginResult = await bilibiliApi.loginWithPhoneSmsCode({
				tel: state.tel.trim(),
				cid: COUNTRY_CODE,
				code: state.smsCode.trim(),
				captchaKey: state.captchaKey,
			})
			if (loginResult.isErr()) {
				let errorMessage = loginResult.error.message
				if (!errorMessage) {
					errorMessage = t('ログインに失敗しました。認証コードを確認してください')
				}
				dispatch({
					type: 'LOGIN_FAIL',
					payload: errorMessage,
				})
				return
			}

			const splitCookies = setCookieParser.splitCookiesString(loginResult.value)
			const parsedCookie = setCookieParser.parse(splitCookies)
			const finalCookieObject = Object.fromEntries(
				parsedCookie.map((c) => [c.name, c.value]),
			)
			const result = setCookie(finalCookieObject)
			if (result.isErr()) {
				toast.error(t('Cookieの保存に失敗しました：') + result.error.message)
				Sentry.captureException(result.error, {
					tags: { Hook: 'usePhoneLogin' },
				})
				dispatch({ type: 'LOGIN_FAIL', payload: t('Cookieの保存に失敗しました') })
				return
			}

			dispatch({ type: 'LOGIN_SUCCESS' })
			toast.success(t('ログインしました'), { id: 'phone-login-success' })
			await queryClient.cancelQueries()
			await queryClient.invalidateQueries({
				queryKey: favoriteListQueryKeys.all,
			})
			await queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
			setTimeout(() => close(), 1000)
		} catch (error) {
			toastAndLogError(t('ログインに失敗しました'), error, 'usePhoneLogin.handleLogin')
			dispatch({ type: 'LOGIN_FAIL', payload: t('ログインに失敗しました') })
		}
	}

	return {
		...state,
		setTel: (payload: string) => dispatch({ type: 'SET_TEL', payload }),
		setSmsCode: (payload: string) =>
			dispatch({ type: 'SET_SMS_CODE', payload }),
		isSendingCode: state.step === 'input_phone' && state.status === 'loading',
		isLoggingIn: state.step === 'input_code' && state.status === 'loading',
		close,
		handleRequestCode,
		handleGeetestMessage,
		handleLogin,
		cancelGeetest: () => dispatch({ type: 'RESET_STEP' }),
		prevStep: () => dispatch({ type: 'RESET_STEP' }),
		setPhoneError: (payload: string) =>
			dispatch({ type: 'SET_PHONE_ERROR', payload }),
		setCodeError: (payload: string) =>
			dispatch({ type: 'SET_CODE_ERROR', payload }),
	}
}
