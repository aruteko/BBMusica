import * as Application from 'expo-application'
import { useEffect } from 'react'

import { useModalStore } from '@/hooks/stores/useModalStore'
import { checkForAppUpdate } from '@/lib/services/updateService'
import { storage } from '@/utils/mmkv'

export default function useCheckUpdate() {
	const open = useModalStore((state) => state.open)
	useEffect(() => {
		if (__DEV__) {
			return
		}
		// BBMusica は公式リリースの更新通知（公式APKへの誘導）を出さない
		if (Application.applicationId === 'com.aruteko.bbmusica') {
			return
		}
		let isMounted = true
		const run = async () => {
			const skipped = storage.getString('skip_version') ?? ''
			const result = await checkForAppUpdate()
			if (!isMounted) return
			if (result.isErr()) return
			const { update } = result.value
			if (!update) return
			if (skipped && skipped === update.version) return
			if (update.forced) {
				open('UpdateApp', update, { dismissible: false })
			} else {
				open('UpdateApp', update, { dismissible: true })
			}
		}
		void run()
		return () => {
			isMounted = false
		}
	}, [open])
}
