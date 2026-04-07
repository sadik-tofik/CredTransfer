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

    // Use Promise.all to run queries in parallel instead of sequentially
    const [
      totalGraduatesResult,
      totalDocumentsResult,
      pendingTransfersResult,
      verifiedDocumentsResult,
      recentActivitiesResult,
      recentGraduatesResult,
      pendingRequestsResult
    ] = await Promise.all([
      // Get total graduates count
      supabaseAdmin
        .from("graduates")
        .select("*", { count: "exact", head: true }),
      
      // Get total documents count
      supabaseAdmin
        .from("documents")
        .select("*", { count: "exact", head: true }),
      
      // Get pending transfers count
      supabaseAdmin
        .from("transfer_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      
      // Get blockchain verified documents count
      supabaseAdmin
        .from("documents")
        .select("*", { count: "exact", head: true })
        .not("blockchain_tx_hash", "is", null),
      
      // Get recent activities
      supabaseAdmin
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
      
      // Get recent graduates
      supabaseAdmin
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
        .limit(5),
      
      // Get pending transfer requests
      supabaseAdmin
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
    ])

    return NextResponse.json({
      success: true,
      stats: {
        totalGraduates: totalGraduatesResult.count || 0,
        totalDocuments: totalDocumentsResult.count || 0,
        pendingTransfers: pendingTransfersResult.count || 0,
        verifiedDocuments: verifiedDocumentsResult.count || 0,
      },
      recentActivities: recentActivitiesResult.data || [],
      recentGraduates: recentGraduatesResult.data || [],
      pendingRequests: pendingRequestsResult.data || [],
    })
  } catch (error) {
    console.error("Error in registrar stats API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
