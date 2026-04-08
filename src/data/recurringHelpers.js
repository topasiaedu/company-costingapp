// Transform recurring from DB format to app format
export function dbToAppRecurring(dbRecurring) {
  return {
    id: dbRecurring.id,
    name: dbRecurring.name,
    category: dbRecurring.category,
    amount: dbRecurring.amount,
    currency: dbRecurring.currency,
    billingDay: dbRecurring.billing_day,
    active: dbRecurring.active === true || dbRecurring.active === 1,
    notes: dbRecurring.notes || '',
    endDate: dbRecurring.end_date || null,
  }
}

// Transform recurring from app format to DB format
export function appToDbRecurring(appRecurring, userId) {
  return {
    id: appRecurring.id,
    user_id: userId,
    name: appRecurring.name,
    category: appRecurring.category,
    amount: parseFloat(appRecurring.amount || 0),
    currency: appRecurring.currency,
    billing_day: parseInt(appRecurring.billingDay || 1),
    active: appRecurring.active === true,
    notes: appRecurring.notes || '',
    end_date: appRecurring.endDate || null,
    created_at: appRecurring.created_at || new Date().toISOString()
  }
}
