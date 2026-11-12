import { StyleSheet, View } from 'react-native'
import { HelperText, Icon, Text, TextInput, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'

interface Props {
	compact?: boolean
	tel: string
	setTel: (v: string) => void
	phoneError: string
	setPhoneError: (v: string) => void
	isSendingCode: boolean
	onBack: () => void
	onRequestCode: () => void
}

export default function InputPhoneStep({
	compact = false,
	tel,
	setTel,
	phoneError,
	setPhoneError,
	isSendingCode,
	onRequestCode,
}: Props) {
	const { colors } = useTheme()

	return (
		<View style={[styles.container, compact && styles.compactContainer]}>
			<View style={[styles.header, compact && styles.compactHeader]}>
				{!compact && (
					<>
						<Icon
							source='television-play'
							size={56}
							color='#FB7299'
						/>
						<Text
							variant='headlineLarge'
							style={styles.title}
						>
							電話番号でログイン
						</Text>
					</>
				)}
				<Text
					variant={compact ? 'bodyMedium' : 'bodyLarge'}
					style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
				>
					未登録の電話番号は、認証後にアカウントが自動で作成されます
				</Text>
			</View>

			<View style={[styles.form, compact && { minHeight: 0 }]}>
				<TextInput
					label='電話番号を入力'
					value={tel}
					onChangeText={(v) => {
						setTel(v)
						setPhoneError('')
					}}
					mode='outlined'
					keyboardType='phone-pad'
					autoComplete='tel'
					error={!!phoneError}
				/>
				{phoneError ? (
					<HelperText
						type='error'
						visible={!!phoneError}
						style={styles.error}
					>
						{phoneError}
					</HelperText>
				) : null}
			</View>

			<View style={[styles.actions, compact && { marginTop: 8 }]}>
				<Button
					mode='contained'
					onPress={onRequestCode}
					loading={isSendingCode}
					disabled={isSendingCode || !tel}
					style={styles.button}
					contentStyle={styles.buttonContent}
					labelStyle={styles.buttonLabel}
				>
					認証コードを取得
				</Button>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	compactContainer: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 8 },
	compactHeader: { marginBottom: 12 },
	container: {
		paddingHorizontal: 32,
		paddingTop: 32,
		paddingBottom: 24,
	},
	header: {
		marginBottom: 40,
		alignItems: 'center',
		gap: 12,
	},
	title: {
		fontWeight: '900',
	},
	subtitle: {
		textAlign: 'center',
	},
	form: {
		minHeight: 80,
	},
	error: {
		paddingHorizontal: 0,
		marginTop: 4,
	},
	actions: {
		marginTop: 24,
	},
	button: {
		borderRadius: 28,
	},
	buttonContent: {
		height: 52,
	},
	buttonLabel: {
		fontSize: 16,
		fontWeight: 'bold',
	},
})
