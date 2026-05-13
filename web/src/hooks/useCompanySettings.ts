import { useState, useEffect, useCallback } from 'react'
import { tenantSettingsAPI } from '../services/api'

export interface CompanySettings {
  nama: string
  alamat: string
  telp: string
  email: string
  npwp: string
  kota: string
  logoDataUrl: string
}

export const DEFAULT_COMPANY: CompanySettings = {
  nama: '',
  alamat: '',
  kota: '',
  telp: '',
  email: '',
  npwp: '',
  logoDataUrl: '',
}

const SETTING_KEY = 'document_company'

export async function loadCompanySettings(): Promise<CompanySettings> {
  try {
    const res = await tenantSettingsAPI.get(SETTING_KEY)
    const data = res?.data?.data
    if (data && typeof data === 'object') return { ...DEFAULT_COMPANY, ...data }
  } catch {}
  return { ...DEFAULT_COMPANY }
}

export function useCompanySettings() {
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tenantSettingsAPI.get(SETTING_KEY)
      .then(res => {
        const data = res?.data?.data
        if (data && typeof data === 'object') {
          setCompany({ ...DEFAULT_COMPANY, ...data })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const saveCompany = useCallback(async (data: CompanySettings) => {
    await tenantSettingsAPI.set(SETTING_KEY, data)
    setCompany(data)
  }, [])

  return { company, setCompany, saveCompany, loading }
}
