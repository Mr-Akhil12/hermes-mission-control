import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/chat/upload — upload a file to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const conversationId = formData.get('conversationId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Generate a unique filename
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `chat-uploads/${conversationId || 'general'}/${timestamp}-${safeName}`

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('chat-files')
      .upload(filePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (error) {
      // If bucket doesn't exist, try to create it
      if (error.message?.includes('Bucket not found')) {
        await supabase.storage.createBucket('chat-files', { public: true })
        // Retry upload
        const { data: retryData, error: retryError } = await supabase.storage
          .from('chat-files')
          .upload(filePath, fileBuffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          })
        if (retryError) {
          return NextResponse.json({ error: retryError.message }, { status: 500 })
        }
        const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(retryData!.path)
        return NextResponse.json({
          url: urlData.publicUrl,
          name: file.name,
          size: file.size,
          type: file.type,
          path: retryData!.path,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path)

    return NextResponse.json({
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
      path: data.path,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
