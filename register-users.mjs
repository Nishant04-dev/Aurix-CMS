import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://einahasstbnpjizpxjzp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbmFoYXNzdGJucGppenB4anpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTI0MTEsImV4cCI6MjA5MDg2ODQxMX0.Z4JV13XFXmW-JIqCeN73ZD-QdTKBp-2OOwZnm_QLUDo'

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupUsers() {
  const users = [
    { email: 'admin@aurix.com', password: 'admin123' },
    { email: 'info.nishantchauhan@gmail.com', password: '11092004' },
    { email: 'client@aurix.com', password: 'client123' }
  ]

  for (const user of users) {
    console.log(`🚀 SIGNING UP: ${user.email}...`)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: user.email,
      password: user.password,
    })

    if (signUpError) {
      console.error(`❌ FAILED ${user.email}: ${signUpError.message}`)
    } else {
      console.log(`✅ SUCCESS ${user.email}: User ID = ${signUpData.user?.id}`)
    }
  }
}

setupUsers()
