import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  const form = new formidable.IncomingForm({ multiples: true, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).send('Error al procesar archivos');

    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
      });

      const authClient = await auth.getClient();

      const drive = google.drive({ version: 'v3', auth: authClient });
      const sheets = google.sheets({ version: 'v4', auth: authClient });

      const sheetId = '1byubnv9-jzUE4zLp7df2j6Iqe6RfcxACKiLPTOSlatE';
      const folderId = '1Q3eawlcY8WUfmzL3VEZzHItcWKnfQgq1If3cR-ykweJKMsUArJsl1w8p2V8locOgqTaU4oPN';

      const unidad = fields.unidad || '';
      const area = fields.area || '';
      const comentarios = fields.comentarios || '';
      const fecha = new Date().toISOString();

      const evidencias = [];
      for (const key in files) {
        const file = files[key];
        const media = {
          mimeType: file.mimetype,
          body: fs.createReadStream(file.filepath),
        };

        const uploaded = await drive.files.create({
          requestBody: {
            name: file.originalFilename,
            parents: [folderId],
          },
          media,
          fields: 'id, webViewLink',
        });

        await drive.permissions.create({
          fileId: uploaded.data.id,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });

        evidencias.push(uploaded.data.webViewLink);
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Respuestas!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[fecha, unidad, area, comentarios, evidencias.join('\n')]],
        },
      });

      res.status(200).send('Respuesta registrada con éxito');
    } catch (error) {
      console.error('Error al procesar el formulario:', error);
      res.status(500).send('Error en el servidor');
    }
  });
}
