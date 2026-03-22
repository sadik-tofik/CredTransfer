import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role from users table for consistency
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    let userRole = userData?.role;
    
    // Fallback to user metadata if users table lookup fails
    if (!userRole && user.user_metadata?.role) {
      userRole = user.user_metadata.role;
    }

    if (!userRole || !['registrar', 'admin'].includes(userRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get total graduates count
    const { count: totalGraduates } = await supabaseAdmin
      .from("graduates")
      .select("*", { count: "exact", head: true })

    // Get total documents count
    const { count: totalDocuments } = await supabaseAdmin
      .from("documents")
      .select("*", { count: "exact", head: true })

    // Get pending transfers count
    const { count: pendingTransfers } = await supabaseAdmin
      .from("transfer_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")

    // Get blockchain verified documents count
    const { count: verifiedDocuments } = await supabaseAdmin
      .from("documents")
      .select("*", { count: "exact", head: true })
      .not("blockchain_tx_hash", "is", null)

    // Get recent activities
    const { data: recentActivities } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)

    // Get recent graduates
    const { data: recentGraduates } = await supabaseAdmin
      .from("graduates")
      .select(`
        id, 
        student_id, 
        graduation_year, 
        department,
        created_at,
        user:users(full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(5)

    // Get pending transfer requests
    const { data: pendingRequests } = await supabaseAdmin
      .from("transfer_requests")
      .select(`
        *,
        graduate:graduates(
          id,
          student_id,
          user:users(full_name)
        ),
        document:documents(
          id,
          document_type,
          file_name
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      stats: {
        totalGraduates: totalGraduates || 0,
        totalDocuments: totalDocuments || 0,
        pendingTransfers: pendingTransfers || 0,
        verifiedDocuments: verifiedDocuments || 0,
      },
      recentActivities: recentActivities || [],
      recentGraduates: recentGraduates || [],
      pendingRequests: pendingRequests || [],
    })
  } catch (error) {
    console.error("Error in registrar stats API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
