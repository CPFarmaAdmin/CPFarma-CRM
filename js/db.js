// ═══════════════════════════════════════════════════════════════
// DB.JS — Capa de base de datos (Supabase)
// Todas las llamadas a la API van aquí
// ═══════════════════════════════════════════════════════════════

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── CONTACTS ──────────────────────────────────────────────────

async function dbGetContacts() {
  const { data, error } = await db
    .from('contacts')
    .select('*, interactions(count)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function dbGetContact(id) {
  const { data, error } = await db
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function dbSaveContact(record) {
  const { id, ...fields } = record;
  if (id) {
    // Update
    const { data, error } = await db
      .from('contacts')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // Insert
    const { data, error } = await db
      .from('contacts')
      .insert(fields)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function dbDeleteContact(id) {
  // Interactions are deleted by CASCADE in the DB
  const { error } = await db
    .from('contacts')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

async function dbDeleteContacts(ids) {
  const { error } = await db
    .from('contacts')
    .delete()
    .in('id', ids);
  if (error) throw error;
}

async function dbMoveContacts(ids, folderId) {
  const { error } = await db
    .from('contacts')
    .update({ folder_id: folderId, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}

// ── INTERACTIONS (history) ─────────────────────────────────────

async function dbGetInteractions(contactId) {
  const { data, error } = await db
    .from('interactions')
    .select('*')
    .eq('contact_id', contactId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function dbAddInteraction(interaction) {
  const { data, error } = await db
    .from('interactions')
    .insert(interaction)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbDeleteInteraction(id) {
  const { error } = await db
    .from('interactions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── FOLDERS ───────────────────────────────────────────────────

async function dbGetFolders() {
  const { data, error } = await db
    .from('folders')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbSaveFolder(folder) {
  const { id, ...fields } = folder;
  if (id) {
    const { data, error } = await db
      .from('folders')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await db
      .from('folders')
      .insert(fields)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function dbDeleteFolder(id) {
  const { error } = await db
    .from('folders')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── TEMPLATES ─────────────────────────────────────────────────

async function dbGetTemplates() {
  const { data, error } = await db
    .from('templates')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function dbSaveTemplate(tpl) {
  const { id, ...fields } = tpl;
  if (id) {
    const { data, error } = await db
      .from('templates')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await db
      .from('templates')
      .insert(fields)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function dbDeleteTemplate(id) {
  const { error } = await db
    .from('templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── USER SETTINGS ─────────────────────────────────────────────

async function dbGetSettings(userId) {
  const { data } = await db
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data || {};
}

async function dbSaveSettings(userId, settings) {
  const { error } = await db
    .from('user_settings')
    .upsert({ user_id: userId, ...settings });
  if (error) throw error;
}

// ── REAL-TIME SUBSCRIPTIONS ───────────────────────────────────

function subscribeToContacts(callback) {
  return db
    .channel('contacts-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'contacts' },
      callback
    )
    .subscribe();
}
