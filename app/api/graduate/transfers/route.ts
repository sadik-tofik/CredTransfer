import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Get graduate record for this user
    const { data: graduate, error: gradError } = await supabaseAdmin
      .from("graduates")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (gradError || !graduate) {
      return NextResponse.json(
        { success: false, error: "Graduate profile not found" },
        { status: 404 },
      );
    }

    // Get transfer requests for this graduate
    const { data: transfers, error: transferError } = await supabaseAdmin
      .from("transfer_requests")
      .select(
        `
        id,
        graduate_id,
        document_id,
        recipient_institution,
        recipient_email,
        payment_status,
        payment_id,
        qr_code,
        hash_code,
        status,
        created_at,
        expires_at,
        graduate:graduates!inner(
          id,
          student_id,
          graduation_year,
          department,
          user:users!inner(
            id,
            full_name,
            email
          )
        ),
        document:documents!inner(
          id,
          document_type,
          file_name,
          file_hash,
          blockchain_tx_hash,
          status
        ),
        payment:payments(
          id,
          amount,
          currency,
          payment_method,
          transaction_reference,
          status,
          paid_at
        )
      `,
      )
      .eq("graduate_id", graduate.id)
      .order("created_at", { ascending: false });

    if (transferError) {
      console.error("Transfer requests fetch error:", transferError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch transfer requests" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: transfers || [],
    });
  } catch (error) {
    console.error("Transfer requests API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
