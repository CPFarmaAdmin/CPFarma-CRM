// ═══════════════════════════════════════════════════════════════
// DB.JS — Capa de base de datos (Supabase)
// ═══════════════════════════════════════════════════════════════

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── CONTACTS ──────────────────────────────────────────────────

async function dbGetContacts() {
  let query = db.from('contacts')
    .select('*, interactions(count)')
    .order('created_at', { ascending: false });

  // Comercials only see their assigned prospects + all clients
  if (currentUserProfile?.role === 'comercial' && currentUser) {
    query = query.or(`type.eq.client,assigned_to.eq.${currentUser.id}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(r => ({
    ...r,
    _noteCount: r.interactions?.[0]?.count || 0,
  }));
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
  // Strip computed/joined fields and columns that may not exist in older DB schemas
  // Run SQL_UPDATE.md v19 to add demo_date and demo_time columns
  const { id, interactions, _noteCount, demo_date, demo_time, assigned_to, ...fields } = record;
  // Only include these fields if they have a value (avoids schema cache error on old DBs)
  if (record.demo_date)    fields.demo_date    = record.demo_date;
  if (record.demo_time)    fields.demo_time    = record.demo_time;
  if ('assigned_to' in record) fields.assigned_to = record.assigned_to || null;
  if (id) {
    const { data, error } = await db
      .from('contacts')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
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
  const { error } = await db.from('contacts').delete().eq('id', id);
  if (error) throw error;
}

async function dbDeleteContacts(ids) {
  const { error } = await db.from('contacts').delete().in('id', ids);
  if (error) throw error;
}

async function dbMoveContacts(ids, folderId) {
  const { error } = await db
    .from('contacts')
    .update({ folder_id: folderId, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}

// ── INTERACTIONS ──────────────────────────────────────────────

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
  const { error } = await db.from('interactions').delete().eq('id', id);
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
    const { data, error } = await db.from('folders').update(fields).eq('id', id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await db.from('folders').insert(fields).select().single();
    if (error) throw error;
    return data;
  }
}

async function dbDeleteFolder(id) {
  // First clear folder_id from contacts (do NOT delete them)
  await db.from('contacts').update({ folder_id: null }).eq('folder_id', id);
  const { error } = await db.from('folders').delete().eq('id', id);
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
    const { data, error } = await db.from('templates').update(fields).eq('id', id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await db.from('templates').insert(fields).select().single();
    if (error) throw error;
    return data;
  }
}

async function dbDeleteTemplate(id) {
  const { error } = await db.from('templates').delete().eq('id', id);
  if (error) throw error;
}

// ── USER SETTINGS ─────────────────────────────────────────────

async function dbGetSettings(userId) {
  const { data } = await db.from('user_settings').select('*').eq('user_id', userId).single();
  return data || {};
}

async function dbSaveSettings(userId, settings) {
  const { error } = await db.from('user_settings').upsert({ user_id: userId, ...settings });
  if (error) throw error;
}

// ── ACTIVITY LOGS ─────────────────────────────────────────────

// Fire-and-forget: call without await to avoid blocking UI actions
async function dbLogActivity(action, entityType, entityId, entityName, details) {
  if (!currentUser) return;
  try {
    await db.from('activity_logs').insert({
      user_id:     currentUser.id,
      user_email:  currentUser.email,
      action,
      entity_type: entityType || null,
      entity_id:   entityId   || null,
      entity_name: entityName || null,
      details:     details    || null,
    });
  } catch(e) {
    console.warn('Log failed:', e.message);
  }
}

async function dbGetActivityLogs({ limit = 60, offset = 0, userId = null, action = null } = {}) {
  let q = db
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (userId) q = q.eq('user_id', userId);
  if (action) q = q.eq('action', action);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ── ORG SETTINGS ──────────────────────────────────────────────

async function dbGetOrgSettings() {
  const { data } = await db.from('org_settings').select('*').eq('id', 1).maybeSingle();
  return data;
}

async function dbSaveOrgSettings(name) {
  const { error } = await db
    .from('org_settings')
    .upsert({ id: 1, name, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── CONTACT FILES ─────────────────────────────────────────────

async function dbGetContactFiles(contactId) {
  const { data, error } = await db
    .from('contact_files')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function dbUploadContactFile(contactId, file) {
  const ext  = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const path = `${contactId}/${Date.now()}.${ext}`;
  const { error: storageErr } = await db.storage.from('contact-files').upload(path, file);
  if (storageErr) throw storageErr;
  const { error: dbErr } = await db.from('contact_files').insert({
    contact_id:  contactId,
    file_name:   file.name,
    file_path:   path,
    file_size:   file.size,
    file_type:   file.type || null,
    uploaded_by: currentUser.id,
  });
  if (dbErr) {
    await db.storage.from('contact-files').remove([path]);
    throw dbErr;
  }
}

async function dbGetContactFileUrl(filePath) {
  const { data, error } = await db.storage.from('contact-files').createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function dbDeleteContactFile(fileId, filePath) {
  await db.storage.from('contact-files').remove([filePath]);
  const { error } = await db.from('contact_files').delete().eq('id', fileId);
  if (error) throw error;
}

// ── REALTIME ──────────────────────────────────────────────────

function subscribeToContacts(callback) {
  return db
    .channel('contacts-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, callback)
    .subscribe();
}
