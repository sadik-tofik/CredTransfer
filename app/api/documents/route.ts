import { NextRequest, NextResponse } from "next/server"
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const graduateId = searchParams.get("graduateId")

    // Get user's role
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    // If graduateId is provided, user must be a registrar
    if (graduateId) {
      if (!userData || (userData.role !== "registrar" && userData.role !== "admin")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }

      const { data: documents, error } = await supabaseAdmin
        .from("documents")
        .select("*")
        .eq("graduate_id", graduateId)
        .order("uploaded_at", { ascending: false })

      if (error) {
        console.error("Error fetching documents:", error)
        return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
      }

      return NextResponse.json({ documents })
    }

    // Get graduate's own documents
    const { data: graduate } = await supabaseAdmin
      .from("graduates")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (!graduate) {
      return NextResponse.json({ error: "Graduate profile not found" }, { status: 404 })
    }

    const { data: documents, error } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("graduate_id", graduate.id)
      .order("uploaded_at", { ascending: false })

    if (error) {
      console.error("Error fetching documents:", error)
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
    }

    return NextResponse.json({ documents })
  } catch (error) {
    console.error("Error in documents API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
