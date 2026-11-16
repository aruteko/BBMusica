import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { fetch } from 'react-native-nitro-fetch'

import useAppStore, { serializeCookieObject } from '@/hooks/stores/useAppStore'
import { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'

import { storage } from '@/utils/mmkv'

import { getCsrfToken } from './utils'
import { t } from '@/i18n'

export const BILIBILI_WEB_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0'

export interface ReqResponse<T> {
	code: number
	message: string
	data: T
}

const toRequestError = (error: unknown) => {
	if (error instanceof Error && error.name === 'AbortError') {
		return new BilibiliApiError({
			message: t('リクエストがキャンセルされました'),
			type: 'RequestAborted',
			cause: error,
		})
	}

	return new BilibiliApiError({
		message: `${t('リクエストに失敗しました: ')}${error instanceof Error ? error.message : String(error)}`,
		type: 'RequestFailed',
		cause: error,
	})
}

const GUEST_COOKIE_KEY = 'bilibili_guest_cookie'
const GUEST_COOKIE_TTL_MS = 24 * 60 * 60 * 1000
const BILIBILI_MOBILE_USER_AGENT =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/6.66.0'

let guestCookiePromise: Promise<string> | null = null

const readCachedGuestCookie = (): string | null => {
	try {
		const raw = storage.getString(GUEST_COOKIE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as { cookie?: string; at?: number }
		if (
			parsed.cookie &&
			typeof parsed.at === 'number' &&
			Date.now() - parsed.at < GUEST_COOKIE_TTL_MS
		) {
			return parsed.cookie
		}
	} catch {
		// 壊れたキャッシュは無視して、取り直す
	}
	return null
}

async function fetchGuestCookie(): Promise<string> {
	try {
		const response = await fetch(
			'https://api.bilibili.com/x/frontend/finger/spi',
			{
				headers: {
					'User-Agent': BILIBILI_MOBILE_USER_AGENT,
					Referer: 'https://www.bilibili.com/',
				},
				credentials: 'omit',
			},
		)
		const json = (await response.json()) as {
			data?: { b_3?: string; b_4?: string }
		}
		const b3 = json.data?.b_3
		const b4 = json.data?.b_4
		if (!b3) return ''
		const cookie = [`buvid3=${b3}`, b4 ? `buvid4=${b4}` : '']
			.filter(Boolean)
			.join('; ')
		storage.set(GUEST_COOKIE_KEY, JSON.stringify({ cookie, at: Date.now() }))
		return cookie
	} catch {
		return ''
	}
}

/**
 * ログインしていないとき用の、匿名の識別 Cookie（buvid3 / buvid4）。
 * Bilibili は、この Cookie が無い検索リクエストに、エラーではなく「空の結果」を返すので、
 * アカウント無しでも検索などが使えるように、自動で取得して付ける。
 */
export function getGuestCookie(): Promise<string> {
	const cached = readCachedGuestCookie()
	if (cached) return Promise.resolve(cached)
	guestCookiePromise ??= fetchGuestCookie().finally(() => {
		guestCookiePromise = null
	})
	return guestCookiePromise
}

/**
 * ログイン済みならそのアカウントの Cookie、そうでなければ匿名の識別 Cookie。
 *
 * QR コードなどでログインして保存される Cookie（SESSDATA など）には、端末の識別
 * （buvid3 / buvid4）が含まれない。公式アプリや公式サイトは、常にこれを一緒に送るので、
 * 無いと、リスク制御に「账号异常」と弾かれる動画がある（いいねなど）。
 * そのため、保存された Cookie に buvid3 が無いときは、識別 Cookie を足して送る。
 */
async function resolveRequestCookie(skipCookie?: boolean): Promise<string> {
	const cookieList = useAppStore.getState().bilibiliCookie
	if (cookieList && !skipCookie) {
		const account = serializeCookieObject(cookieList)
		if (cookieList.buvid3) return account
		const guest = await getGuestCookie()
		return guest ? `${account}; ${guest}` : account
	}
	return getGuestCookie()
}

class ApiClient {
	private baseUrl = 'https://api.bilibili.com'

	/**
	 * 核心请求 method，使用 neverthrow 进行封装
	 */
	private request = <T>({
		endpoint,
		options = {},
		fullUrl,
		skipCookie,
	}: {
		endpoint: string
		options?: RequestInit
		fullUrl?: string
		skipCookie?: boolean
	}): ResultAsync<T, BilibiliApiError> => {
		const url = fullUrl ?? `${this.baseUrl}${endpoint}`

		return ResultAsync.fromPromise(
			(async () => {
				const cookie = await resolveRequestCookie(skipCookie)

				const defaultHeaders = {
					Cookie: cookie,
					'User-Agent': BILIBILI_MOBILE_USER_AGENT,
					Referer: 'https://www.bilibili.com/',
					Origin: 'https://www.bilibili.com',
				}

				const headers = new Headers(defaultHeaders)

				if (options.headers) {
					new Headers(options.headers).forEach((value, key) => {
						headers.set(key, value)
					})
				}

				return fetch(url, {
					...options,
					headers,
					// react native 实现了 cookie 的自动注入，但我们正在自己管理 cookie，所以忽略
					// TODO: 应该采用 react-native-cookie 库实现与原生请求库 cookie jar 的更紧密集成。但现阶段我们直接忽略原生注入的 cookie。
					credentials: 'omit',
				})
			})(),
			toRequestError,
		)
			.andThen((response) => {
				if (!response.ok) {
					return errAsync(
						new BilibiliApiError({
							message: `${t('Bilibili APIへのリクエストに失敗しました: ')}${response.status} ${response.statusText}`,
							msgCode: response.status,
							type: 'RequestFailed',
						}),
					)
				}
				const data = response.json() as Promise<ReqResponse<T>>
				return ResultAsync.fromPromise(
					data,
					(error) =>
						new BilibiliApiError({
							message: error instanceof Error ? error.message : String(error),
							type: 'ResponseFailed',
						}),
				)
			})
			.andThen((data) => {
				// 对于 wbi 接口，直接返回 data，因为未登录状态下 code 为 -101
				if (endpoint === '/x/web-interface/nav') {
					return okAsync(data.data)
				}
				if (data.code !== 0) {
					return errAsync(
						new BilibiliApiError({
							message: data.message,
							msgCode: data.code,
							rawData: data.data,
							type: 'ResponseFailed',
						}),
					)
				}
				return okAsync(data.data)
			})
	}

	/**
	 * 发送 GET 请求
	 * @returns ResultAsync 包含成功数据或错误
	 */
	get<T>({
		endpoint,
		params,
		headers,
		fullUrl,
		skipCookie,
		signal,
	}: {
		endpoint: string
		params?: Record<string, string | undefined> | string
		headers?: Record<string, string>
		fullUrl?: string
		skipCookie?: boolean
		signal?: AbortSignal
	}): ResultAsync<T, BilibiliApiError> {
		let url = endpoint
		if (typeof params === 'string') {
			url = `${endpoint}?${params}`
		} else if (params) {
			const searchParams = new URLSearchParams()
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					searchParams.append(key, value)
				}
			}
			url = `${endpoint}?${searchParams.toString()}`
		}
		return this.request<T>({
			endpoint: url,
			options: { method: 'GET', signal, headers },
			fullUrl,
			skipCookie,
		})
	}

	/**
	 * 发送 GET 请求并返回 ArrayBuffer
	 * @returns ResultAsync 包含 ArrayBuffer 或错误
	 */
	getBuffer({
		endpoint,
		params,
		headers,
		fullUrl,
		skipCookie,
		signal,
	}: {
		endpoint: string
		params?: Record<string, string | undefined> | string
		headers?: Record<string, string>
		fullUrl?: string
		skipCookie?: boolean
		signal?: AbortSignal
	}): ResultAsync<ArrayBuffer, BilibiliApiError> {
		let url = endpoint
		if (typeof params === 'string') {
			url = `${endpoint}?${params}`
		} else if (params) {
			const searchParams = new URLSearchParams()
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					searchParams.append(key, value)
				}
			}
			url = `${endpoint}?${searchParams.toString()}`
		}
		const requestUrl = fullUrl ?? `${this.baseUrl}${url}`

		return ResultAsync.fromPromise(
			(async () => {
				const cookie = await resolveRequestCookie(skipCookie)
				const requestHeaders = {
					Cookie: cookie,
					'User-Agent': BILIBILI_MOBILE_USER_AGENT,
					Referer: 'https://www.bilibili.com/',
					Origin: 'https://www.bilibili.com',
					...headers,
				}
				return fetch(requestUrl, {
					method: 'GET',
					headers: requestHeaders,
					signal,
					credentials: 'omit',
				})
			})(),
			toRequestError,
		).andThen((response) => {
			if (!response.ok) {
				return errAsync(
					new BilibiliApiError({
						message: `${t('Bilibili APIへのリクエストに失敗しました: ')}${response.status} ${response.statusText}`,
						msgCode: response.status,
						type: 'RequestFailed',
					}),
				)
			}
			return ResultAsync.fromPromise(
				response.arrayBuffer(),
				(error) =>
					new BilibiliApiError({
						message: error instanceof Error ? error.message : String(error),
						type: 'ResponseFailed',
					}),
			)
		})
	}

	/**
	 * 发送 POST 请求
	 * @returns ResultAsync 包含成功数据或错误
	 */
	post<T>({
		endpoint,
		data,
		headers,
		fullUrl,
		skipCookie,
	}: {
		endpoint: string
		data?: BodyInit
		headers?: Record<string, string>
		fullUrl?: string
		skipCookie?: boolean
	}): ResultAsync<T, BilibiliApiError> {
		return this.request<T>({
			endpoint,
			options: {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					...headers,
				},
				body: data,
			},
			fullUrl,
			skipCookie,
		})
	}

	/**
	 * 自动处理 CSRF token 并发送 POST 请求 (x-www-form-urlencoded)
	 */
	public postWithCsrf<T>({
		endpoint,
		payload = {},
		headers,
	}: {
		endpoint: string
		payload?: Record<string, string>
		headers?: Record<string, string>
	}): ResultAsync<T, BilibiliApiError> {
		return getCsrfToken().asyncAndThen((csrfToken) => {
			// 公式の Web 版は、POST のたびに csrf と csrf_token の両方に同じ値を入れて送る
			const dataWithCsrf = {
				...payload,
				csrf_token: csrfToken,
				csrf: csrfToken,
			}

			const body = new URLSearchParams(dataWithCsrf).toString()

			return this.post<T>({ endpoint, data: body, headers })
		})
	}
}
export const bilibiliApiClient = new ApiClient()
