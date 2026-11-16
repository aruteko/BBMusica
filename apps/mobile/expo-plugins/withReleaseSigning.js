const { withAppBuildGradle } = require('expo/config-plugins')

/**
 * BBMusica（APP_VARIANT=jp）のリリースビルドに、自分の署名鍵を使う。
 *
 * 鍵とパスワードはリポジトリに入れず、ユーザーの Gradle 設定
 * （~/.gradle/gradle.properties）から読む：
 *   BBMUSICA_STORE_FILE=C:/Users/xxx/.bbmusica/bbmusica-release.jks
 *   BBMUSICA_STORE_PASSWORD=...
 *   BBMUSICA_KEY_ALIAS=bbmusica
 *   BBMUSICA_KEY_PASSWORD=...
 * 設定が無いときは何もしない（Expo 既定のデバッグ鍵でビルドされる）。
 */
const signingBlock = `
// BBMusica: release signing from the user's gradle.properties (keeps keys out of the repo).
if (project.hasProperty('BBMUSICA_STORE_FILE')) {
    def bbmusicaRelease = android.signingConfigs.create('bbmusicaRelease') {
        storeFile file(project.property('BBMUSICA_STORE_FILE'))
        storePassword project.property('BBMUSICA_STORE_PASSWORD')
        keyAlias project.property('BBMUSICA_KEY_ALIAS')
        keyPassword project.property('BBMUSICA_KEY_PASSWORD')
    }
    android.buildTypes.release.signingConfig = bbmusicaRelease
}
`

module.exports = (config) => {
	if (process.env.APP_VARIANT !== 'jp') return config

	return withAppBuildGradle(config, (config) => {
		if (config.modResults.language !== 'groovy') {
			throw new Error('Release signing requires a Groovy build.gradle.')
		}
		if (!config.modResults.contents.includes(signingBlock)) {
			config.modResults.contents += signingBlock
		}
		return config
	})
}
