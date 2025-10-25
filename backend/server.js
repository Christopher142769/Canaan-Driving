require('dotenv').config(); // <-- MODIFICATION: Charger les variables d'environnement

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

// --- Initialisation de l'application ---
const app = express();
const PORT = process.env.PORT || 5000; // Utiliser la variable d'environnement

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Connexion à MongoDB ---
const mongoURI = process.env.MONGO_URI; // Maintenant chargé depuis .env
mongoose.connect(mongoURI)
.then(() => console.log('✅ Connecté à MongoDB'))
.catch(err => console.error('❌ Erreur de connexion à MongoDB:', err));

// --- Schémas Mongoose ---
const companySchema = new mongoose.Schema({
  companyName: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const Company = mongoose.model('Company', companySchema);

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['file', 'folder'], required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
  content: { type: Buffer },
  mimetype: { type: String },
  createdAt: { type: Date, default: Date.now },
});
const File = mongoose.model('File', fileSchema);

// --- Clé secrète JWT ---
// Utiliser la variable chargée depuis .env ou une valeur par défaut
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only';

// --- Middleware d'Authentification (JWT) ---
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).json({ msg: 'Aucun token, autorisation refusée' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.company = decoded.company;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token non valide' });
    }
};

// --- Configuration Multer (Stockage en mémoire) ---
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // Limite à 100MB
});

// --- FONCTIONS UTILITAIRES ---
const deleteFolderContents = async (itemId, companyId) => {
    const item = await File.findOne({ _id: itemId, companyId });
    if (!item) return;

    if (item.type === 'folder') {
        const children = await File.find({ parentId: item._id, companyId });
        for (const child of children) {
            await deleteFolderContents(child._id, companyId);
        }
    }
    await File.deleteOne({ _id: itemId });
};

// --- ROUTES D'AUTHENTIFICATION ---
app.post('/api/register', async (req, res) => {
    const { companyName, password } = req.body;
    try {
        let company = await Company.findOne({ companyName });
        if (company) {
            return res.status(400).json({ msg: 'Cette entreprise existe déjà' });
        }
        company = new Company({ companyName, password });
        const salt = await bcrypt.genSalt(10);
        company.password = await bcrypt.hash(password, salt);
        await company.save();

        const payload = { company: { id: company.id } };
        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur du serveur (Inscription)');
    }
});

app.post('/api/login', async (req, res) => {
    const { companyName, password } = req.body;
    try {
        let company = await Company.findOne({ companyName });
        if (!company) {
            return res.status(400).json({ msg: 'Identifiants invalides' });
        }
        const isMatch = await bcrypt.compare(password, company.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Identifiants invalides' });
        }
        const payload = { company: { id: company.id } };
        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur du serveur (Connexion)');
    }
});


// --- ROUTES DE GESTION DE FICHIERS ET DOSSIERS ---

// 1. UPLOAD DE FICHIERS
app.post('/api/files', auth, upload.array('files'), async (req, res) => {
    const { parentId } = req.body;
    const files = req.files;
    const companyId = req.company.id;

    if (!files || files.length === 0) {
        return res.status(400).json({ msg: 'Aucun fichier sélectionné.' });
    }

    try {
        const savedFiles = [];
        for (const file of files) {
            const newFile = new File({
                name: file.originalname,
                type: 'file',
                companyId,
                parentId: parentId === 'null' || !parentId ? null : parentId,
                content: file.buffer,
                mimetype: file.mimetype,
            });
            const saved = await newFile.save();
            savedFiles.push(saved);
        }
        res.status(201).json({ msg: `${savedFiles.length} fichier(s) uploadé(s) avec succès`, files: savedFiles });
    } catch (err) {
        console.error("Erreur Upload Fichiers:", err.message);
        res.status(500).send('Erreur du serveur lors de l\'upload');
    }
});

// 2. UPLOAD DE DOSSIERS (avec corrections cache et path separator)
app.post('/api/upload-folder', auth, upload.array('files'), async (req, res) => {
    const { rootParentId, paths: pathsJson } = req.body;
    const files = req.files;
    const companyId = req.company.id;

    if (!files || files.length === 0 || !pathsJson) {
        return res.status(400).json({ msg: 'Fichiers ou chemins manquants.' });
    }

    let paths;
    try {
        paths = JSON.parse(pathsJson);
        if (!Array.isArray(paths) || paths.length !== files.length) {
            throw new Error("Paths array doesn't match files array length");
        }
    } catch (e) {
        return res.status(400).json({ msg: 'Format des chemins invalide.' });
    }

    try {
        const folderCache = {};

        const getOrCreateFolder = async (folderName, currentParentId) => {
            if (!folderName) return currentParentId;

            const parentIdForQuery = currentParentId === 'null' || !currentParentId ? null : currentParentId;
            const cacheKey = `${parentIdForQuery || 'root'}:${folderName}`;

            if (folderCache[cacheKey]) {
                return folderCache[cacheKey];
            }

            let folder = await File.findOne({
                name: folderName,
                type: 'folder',
                parentId: parentIdForQuery,
                companyId
            });

            if (!folder) {
                folder = new File({
                    name: folderName,
                    type: 'folder',
                    companyId,
                    parentId: parentIdForQuery,
                });
                await folder.save();
                console.log(`Dossier créé: ${folderName} sous ${parentIdForQuery || 'Racine'}`);
            }

            // --- CORRECTION (Bug Cache) ---
            folderCache[cacheKey] = folder; // Mettre dans le cache après find ou create
            // --- FIN CORRECTION ---

            return folder;
        };

        let savedFilesInfo = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fullPath = paths[i];

            // --- CORRECTION (Bug Séparateur) ---
            const parts = fullPath.split('/').filter(p => p); // Toujours utiliser '/'
            // --- FIN CORRECTION ---

            const fileName = parts.pop();
            let currentParentId = rootParentId === 'null' || !rootParentId ? null : rootParentId;

            for (const part of parts) {
                const folder = await getOrCreateFolder(part, currentParentId);
                currentParentId = folder._id;
            }

            const newFile = new File({
                name: fileName,
                type: 'file',
                companyId,
                parentId: currentParentId,
                content: file.buffer,
                mimetype: file.mimetype,
            });
            const savedFile = await newFile.save();
            savedFilesInfo.push(savedFile);
        }

        res.status(201).json({ msg: 'Téléversement du dossier terminé avec succès', files: savedFilesInfo });

    } catch (err) {
        console.error("Erreur Upload Dossier:", err.message);
        res.status(500).send('Erreur du serveur lors de l\'upload du dossier');
    }
});


// 3. CRÉATION DE DOSSIER VIDE
app.post('/api/folders', auth, async (req, res) => {
    const { name, parentId } = req.body;
    const parentIdForQuery = parentId === 'null' || !parentId ? null : parentId;

    if (!name || name.trim() === '') {
         return res.status(400).json({ msg: 'Le nom du dossier ne peut pas être vide.' });
    }

    try {
        const existingFolder = await File.findOne({
            name: name.trim(),
            type: 'folder',
            companyId: req.company.id,
            parentId: parentIdForQuery
        });

        if (existingFolder) {
            return res.status(400).json({ msg: `Un dossier nommé "${name.trim()}" existe déjà ici.` });
        }

        const newFolder = new File({
            name: name.trim(),
            type: 'folder',
            companyId: req.company.id,
            parentId: parentIdForQuery,
        });
        await newFolder.save();
        res.status(201).json(newFolder);
    } catch (err) {
        console.error("Erreur création dossier:", err.message);
        res.status(500).send('Erreur du serveur');
    }
});

// 4. NAVIGATION (Browse)
app.get('/api/browse', auth, async (req, res) => {
    const { parentId } = req.query;
    try {
        const items = await File.find({
            companyId: req.company.id,
            parentId: parentId === 'null' ? null : parentId || null,
        }).select('-content')
          .sort({ type: -1, name: 1 }); // Dossiers en premier, puis tri alpha
        res.json(items);
    } catch (err) {
        console.error("Erreur Browse:", err.message);
        res.status(500).send('Erreur du serveur');
    }
});

// 5. TÉLÉCHARGEMENT DE FICHIER
app.get('/api/download/file/:id', auth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file || file.companyId.toString() !== req.company.id || file.type !== 'file') {
            return res.status(404).send('Fichier non trouvé');
        }
        res.set('Content-Type', file.mimetype || 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
        res.send(file.content);
    } catch (err) {
        console.error("Erreur Téléchargement Fichier:", err.message);
        res.status(500).send('Erreur du serveur');
    }
});

// 6. TÉLÉCHARGEMENT DE DOSSIER (ZIP)
app.get('/api/download/folder/:id', auth, async (req, res) => {
    try {
        const rootFolder = await File.findById(req.params.id);
        if (!rootFolder || rootFolder.companyId.toString() !== req.company.id || rootFolder.type !== 'folder') {
            return res.status(404).send('Dossier non trouvé');
        }

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(rootFolder.name)}.zip"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('warning', (err) => { console.warn("Archiver warning:", err); });
        archive.on('error', (err) => { throw err; });
        archive.pipe(res);

        const addItemsToArchive = async (folderId, currentPath) => {
            const items = await File.find({ parentId: folderId, companyId: req.company.id }).select('-companyId');
            for (const item of items) {
                const itemPath = path.join(currentPath, item.name); // Utiliser path.join pour la compatibilité OS
                if (item.type === 'file') {
                    const fileWithContent = await File.findById(item._id); // Récupérer le contenu ici
                    if (fileWithContent && fileWithContent.content) {
                        archive.append(fileWithContent.content, { name: itemPath });
                    } else {
                         console.warn(`Contenu manquant pour le fichier ${itemPath}`);
                    }
                } else {
                    archive.append(null, { name: `${itemPath}/` }); // Ajouter le '/' pour les dossiers
                    await addItemsToArchive(item._id, itemPath);
                }
            }
        };

        archive.append(null, { name: `${rootFolder.name}/` });
        await addItemsToArchive(req.params.id, rootFolder.name);

        await archive.finalize();

    } catch (err) {
        console.error("Erreur Archivage Dossier:", err);
        if (!res.headersSent) {
            res.status(500).send('Erreur serveur pendant l\'archivage');
        } else {
             res.end();
        }
    }
});

// 7. VISUALISATION DE CONTENU TEXTE/JSON
app.get('/api/file/content/:id', auth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file || file.companyId.toString() !== req.company.id || file.type !== 'file') {
            return res.status(404).json({ msg: 'Fichier non trouvé' });
        }

        if (file.mimetype?.startsWith('text/') || file.mimetype === 'application/json') {
            res.set('Content-Type', file.mimetype || 'text/plain');
            res.send(file.content.toString('utf8'));
        } else {
            return res.status(400).json({ msg: `Prévisualisation non supportée pour le type MIME : ${file.mimetype || 'inconnu'}` });
        }

    } catch (err) {
        console.error("Erreur Contenu Fichier:", err.message);
        res.status(500).send('Erreur du serveur');
    }
});


// 8. RENOMMAGE
app.put('/api/items/:id', auth, async (req, res) => {
    const { newName } = req.body;
    if (!newName || newName.trim() === '') {
        return res.status(400).json({ msg: 'Le nouveau nom ne peut pas être vide.' });
    }

    try {
        const item = await File.findById(req.params.id);
        if (!item || item.companyId.toString() !== req.company.id) {
            return res.status(404).json({ msg: 'Élément non trouvé ou accès refusé.' });
        }

        const existingItem = await File.findOne({
            name: newName.trim(),
            parentId: item.parentId,
            companyId: req.company.id,
            type: item.type,
            _id: { $ne: req.params.id }
        });

        if (existingItem) {
            return res.status(400).json({ msg: `Un ${item.type === 'folder' ? 'dossier' : 'fichier'} nommé "${newName.trim()}" existe déjà dans ce répertoire.` });
        }

        item.name = newName.trim();
        await item.save();
        res.json({ msg: 'Élément renommé avec succès', item });
    } catch (err) {
        console.error("Erreur Renommage:", err.message);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).send('Erreur du serveur lors du renommage');
    }
});


// 9. SUPPRESSION
app.delete('/api/items/:id', auth, async (req, res) => {
    try {
        const itemId = req.params.id;
        const companyId = req.company.id;

        const item = await File.findById(itemId);
        if (!item || item.companyId.toString() !== companyId) {
            return res.status(404).json({ msg: 'Élément non trouvé ou accès refusé' }); // Status 404 est plus approprié
        }

        await deleteFolderContents(itemId, companyId);

        res.json({ msg: `${item.type === 'folder' ? 'Dossier' : 'Fichier'} et son contenu supprimés avec succès` });
    } catch (err) {
        console.error("Erreur Suppression:", err.message);
        res.status(500).send('Erreur du serveur lors de la suppression');
    }
});


// --- Démarrage du serveur ---
app.listen(PORT, () => console.log(`🚀 Serveur Canaan Driving démarré sur le port ${PORT}`));