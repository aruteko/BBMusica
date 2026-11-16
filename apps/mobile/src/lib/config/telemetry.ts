import * as Application from 'expo-application'

/**
 * 上流（BBPlayer）の公式アプリかどうか。
 * 計測データ（Sentry / Expo Observe）の送り先は上流の作者のプロジェクトなので、
 * 派生アプリ（BBMusica など）からは、設定にかかわらず送らない。
 */
export const isUpstreamOfficialApp: boolean =
	Application.applicationId?.startsWith('com.roitium.') ?? false
