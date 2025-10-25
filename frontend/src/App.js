// App.js (Refonte Frontend - "Zinzin Pro" avec Overlay d'Upload Centré)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css'; // IMPORTANT: Utiliser la nouvelle version de App.css
import {
    Modal, Button, Dropdown, Form, Breadcrumb, Container, Row, Col,
    Spinner, InputGroup, ListGroup, Card, ButtonGroup
} from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion'; // Pour les animations

// --- URL Base de l'API (Centralisée) ---
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://canaan-driving.onrender.com/api';

// --- Configuration d'Axios ---
const api = axios.create({
  baseURL: API_BASE_URL,
});

const setAuthToken = token => {
  if (token) {
    api.defaults.headers.common['x-auth-token'] = token;
  } else {
    delete api.defaults.headers.common['x-auth-token'];
  }
};

// --- Correction de l'erreur 401 au rechargement ---
setAuthToken(localStorage.getItem('token'));


// --- COMPOSANT : Icône de Fichier (Amélioré) ---
const FileIcon = ({ type, mimetype }) => {
    let iconClass = 'bi-file-earmark'; // Default file

    // Utilisation des variables CSS de Bootstrap pour la cohérence
    if (type === 'folder') {
        iconClass = 'bi-folder-fill text-primary';
    } else if (mimetype) {
        if (mimetype.startsWith('image/')) { iconClass = 'bi-file-earmark-image text-success'; }
        else if (mimetype.startsWith('video/')) { iconClass = 'bi-file-earmark-play text-info'; }
        else if (mimetype.startsWith('audio/')) { iconClass = 'bi-file-earmark-music text-warning'; }
        else if (mimetype === 'application/pdf') { iconClass = 'bi-file-earmark-pdf text-danger'; }
        else if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('archive')) { iconClass = 'bi-file-earmark-zip text-secondary'; } // Couleur moins agressive
        else if (mimetype.startsWith('text/')) { iconClass = 'bi-file-earmark-text text-secondary'; }
        else if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) { iconClass = 'bi-file-earmark-excel text-success'; }
        else if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) { iconClass = 'bi-file-earmark-ppt text-danger'; }
        else if (mimetype.includes('document') || mimetype.includes('word')) { iconClass = 'bi-file-earmark-word text-primary'; }
        else { iconClass = 'bi-file-earmark-binary text-secondary'; }
    }

    // Taille ajustée dans le CSS
    return <i className={`bi ${iconClass}`}></i>;
};


// --- COMPOSANT : Notifications Toast (Avec Animation) ---
const Toast = ({ message, type, onDismiss, id }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const bg = type === 'success' ? 'bg-success' : 'bg-danger';
    const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-x-octagon-fill';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`toast-notification m-2 show ${bg} text-white shadow-lg rounded d-flex align-items-center`} // shadow-lg
            onClick={onDismiss}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
        >
            <i className={`bi ${icon} me-2 fs-5 px-2`}></i>
            <span className="toast-body py-2">{message}</span>
            <button type="button" className="btn-close btn-close-white ms-auto me-2" aria-label="Close" onClick={onDismiss}></button>
        </motion.div>
    );
};

// --- COMPOSANT : Indicateur d'Upload (Individuel) ---
const UploadIndicator = ({ upload }) => {
    // const isUploading = upload.progress >= 0 && upload.progress < 100 && !upload.error; // Retiré car non utilisé
    const isComplete = upload.progress === 100 && !upload.error;
    const isError = !!upload.error;
    const isIndeterminate = upload.progress === -1 && !upload.error; // Pour les dossiers

    let statusIcon = <Spinner animation="border" size="sm" variant="primary" />;
    let progressBarVariant = "primary";
    let progressBarAnimated = true;
    let textClass = "text-muted";

    if (isComplete) {
        statusIcon = <i className="bi bi-check-circle-fill text-success"></i>;
        progressBarVariant = "success";
        progressBarAnimated = false;
        textClass = "text-success";
    } else if (isError) {
         statusIcon = <i className="bi bi-x-octagon-fill text-danger"></i>;
         progressBarVariant = "danger";
         progressBarAnimated = false;
         textClass = "text-danger";
    } else if (isIndeterminate) {
         statusIcon = <Spinner animation="border" size="sm" variant="secondary" />;
         progressBarVariant = "secondary";
         progressBarAnimated = true;
         textClass = "text-muted";
    }

    return (
        // motion.div utilisé par le parent AnimatePresence
        <motion.div
            layout // Permet d'animer les changements de layout (ajout/suppression)
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: '0.5rem' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`upload-indicator-item bg-light p-2 mb-2 rounded border shadow-sm`} // Style neutre de base, ajusté dans App.css
        >
            <div className="d-flex align-items-center">
                <div className="me-2">{statusIcon}</div>
                <div className="flex-grow-1 text-truncate small me-2" style={{ minWidth: 0 }}> {/* Fix overflow */}
                    <span className="fw-medium">{upload.name}</span>
                    {isError && <div className="text-danger small mt-1" title={upload.error}>{upload.error}</div>}
                </div>
                {!isIndeterminate && <div className={`fw-bold small ${textClass}`}>{upload.progress}%</div>}
            </div>
            {!isIndeterminate && (
                <div className="progress mt-1" style={{ height: '5px' }}>
                    <div
                        className={`progress-bar ${progressBarAnimated ? 'progress-bar-striped progress-bar-animated' : ''} bg-${progressBarVariant}`}
                        role="progressbar"
                        style={{ width: `${upload.progress}%` }}
                        aria-valuenow={upload.progress}
                        aria-valuemin="0"
                        aria-valuemax="100"
                    ></div>
                </div>
            )}
             {isIndeterminate && (
                 <div className="progress mt-1" style={{ height: '5px' }}>
                     <div
                        className={`progress-bar progress-bar-striped progress-bar-animated bg-${progressBarVariant}`}
                        role="progressbar"
                        style={{ width: `100%` }}
                        aria-valuenow={100}
                        aria-valuemin="0"
                        aria-valuemax="100"
                    ></div>
                </div>
            )}
        </motion.div>
    );
};

// --- NOUVEAU COMPOSANT : Overlay d'Upload Centré ---
const UploadOverlay = ({ uploads, onClose }) => { // Ajout de onClose
    const uploadItems = Object.values(uploads);
    const hasActiveUploads = uploadItems.some(u => (u.progress >= 0 && u.progress < 100 && !u.error) || u.progress === -1);
    const totalFiles = uploadItems.length;
    const completedFiles = uploadItems.filter(u => u.progress === 100 && !u.error).length;
    const hasErrors = uploadItems.some(u => u.error);

    let overallProgress = 0;
    if (totalFiles > 0) {
        const totalProgressSum = uploadItems.reduce((sum, u) => sum + (u.progress >= 0 ? u.progress : 0), 0);
        overallProgress = Math.round(totalProgressSum / totalFiles);
    }

    return (
        // L'overlay prend tout l'écran avec fond semi-transparent
        <motion.div
            className="upload-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            {/* Le conteneur de contenu, centré */}
            <motion.div
                className="upload-overlay-content card shadow-lg" // Utiliser card pour le style
                initial={{ scale: 0.7, opacity: 0, y: -50 }} // Ajout d'un léger décalage Y
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.7, opacity: 0, y: -50 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
                <Card.Header className="d-flex justify-content-between align-items-center bg-primary text-white">
                    <h6 className="mb-0">
                        {hasActiveUploads ? 'Upload en cours...' : (hasErrors ? 'Erreurs d\'upload' : 'Upload Terminé')}
                    </h6>
                     {/* Bouton Fermer si pas d'uploads actifs */}
                     {!hasActiveUploads && (
                        <Button variant="close" className="btn-close-white" onClick={onClose} aria-label="Fermer"></Button>
                    )}
                </Card.Header>
                <Card.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {totalFiles > 1 && ( // Afficher la barre globale si plus d'un fichier
                        <div className="mb-3">
                             <div className="d-flex justify-content-between small mb-1 text-muted">
                                <span>Progression globale</span>
                                <span>{completedFiles} / {totalFiles}</span>
                             </div>
                             <div className="progress" style={{ height: '8px', borderRadius: '4px' }}> {/* Coins arrondis */}
                                <div
                                    className={`progress-bar ${hasActiveUploads ? 'progress-bar-striped progress-bar-animated' : ''} ${hasErrors ? 'bg-warning' : (hasActiveUploads ? 'bg-primary' : 'bg-success')}`}
                                    role="progressbar"
                                    style={{ width: `${overallProgress}%`, transition: 'width 0.3s ease-out' }} // Transition ajoutée ici aussi
                                    aria-valuenow={overallProgress}
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                ></div>
                            </div>
                        </div>
                    )}

                    <AnimatePresence>
                        {uploadItems.map(upload => (
                            <UploadIndicator key={upload.tempId} upload={upload} />
                        ))}
                    </AnimatePresence>
                </Card.Body>
                {!hasActiveUploads && ( // Bouton OK si terminé ou erreurs
                    <Card.Footer className="text-end bg-light border-0 pt-2 pb-2"> {/* Footer plus léger */}
                        <Button variant="primary" size="sm" onClick={onClose} className="px-3">
                            OK
                        </Button>
                    </Card.Footer>
                )}
            </motion.div>
        </motion.div>
    );
};



// --- COMPOSANT PRINCIPAL : App ---
function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [companyName, setCompanyName] = useState(''); // Store company name after login

  // Function to decode JWT and get company name (basic example)
  const getCompanyNameFromToken = (jwtToken) => {
      if (!jwtToken) return '';
      try {
          return localStorage.getItem('companyName') || 'Mon Espace'; // Default plus générique
      } catch (e) {
          console.error("Failed to decode token:", e);
          return 'Mon Espace';
      }
  };

  useEffect(() => {
    setAuthToken(token);
    if (token) {
        setCompanyName(getCompanyNameFromToken(token));
    } else {
        localStorage.removeItem('companyName');
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('companyName');
    setToken(null);
    setCompanyName('');
  };

  useEffect(() => {
    document.body.classList.toggle('auth-page-background', !token);
    document.body.classList.toggle('dashboard-background', !!token);
    return () => {
        document.body.classList.remove('auth-page-background');
        document.body.classList.remove('dashboard-background');
    }
  }, [token]);

  if (!token) {
    return <Auth setToken={setToken} />;
  }

  return (
    <div className="app-container-canaan">
        <header className="app-header-canaan">
             <Container fluid className="d-flex justify-content-between align-items-center">
                 <div className="logo d-flex align-items-center">
                    <i className="bi bi-clouds-fill"></i>
                    <span className="fw-bold fs-5">Canaan Drive</span>
                    <span className="ms-3 text-white-50 d-none d-md-inline">| {companyName}</span>
                 </div>
                 <Button variant="outline-light" size="sm" onClick={handleLogout} className="logout-btn">
                    <i className="bi bi-box-arrow-right me-1"></i>
                    <span className="d-none d-sm-inline">Déconnexion</span>
                </Button>
             </Container>
        </header>
        <main className="app-main-canaan">
             {/* Utilisation de motion pour une transition douce si App re-render */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                <Dashboard />
            </motion.div>
        </main>
        {/* Footer could go here */}
    </div>
  );
}


// --- COMPOSANT : Auth (Relooké) ---
const Auth = ({ setToken }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLogin && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setError('');
    setLoading(true);

    const url = isLogin ? '/login' : '/register';
    const payload = { companyName, password };

    try {
      const res = await api.post(url, payload);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('companyName', companyName); // Store company name
      setToken(res.data.token);
    } catch (err) {
      setError(err.response?.data?.msg || 'Une erreur est survenue');
      // Simple animation on error
      const card = document.querySelector('.auth-card-canaan');
      if (card) {
          // Utiliser une animation CSS si disponible ou juste un effet simple
          card.style.animation = 'headShake 0.8s ease-in-out';
          setTimeout(() => card.style.animation = '', 800);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
     // Animation d'entrée pour la page
     <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Container className="auth-container-canaan d-flex align-items-center justify-content-center min-vh-100">
            <Card className="auth-card-canaan">
                <Card.Body>
                    <div className="text-center mb-4">
                        <i className="bi bi-clouds-fill text-primary mb-3"></i>
                        <h2 className="text-dark fw-bold">{isLogin ? 'Connexion' : 'Inscription'}</h2>
                        <p className="text-muted">Accédez à votre espace Canaan Drive.</p>
                    </div>

                    {error && <div className="alert alert-danger py-2 d-flex align-items-center"><i className="bi bi-exclamation-triangle-fill me-2"></i>{error}</div>}

                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <InputGroup>
                                <InputGroup.Text><i className="bi bi-building"></i></InputGroup.Text>
                                <Form.Control type="text" placeholder="Nom de l'entreprise" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                            </InputGroup>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <InputGroup>
                                <InputGroup.Text><i className="bi bi-lock-fill"></i></InputGroup.Text>
                                <Form.Control type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
                            </InputGroup>
                        </Form.Group>
                        {!isLogin && (
                            <Form.Group className="mb-4">
                                <InputGroup>
                                    <InputGroup.Text><i className="bi bi-check-circle-fill"></i></InputGroup.Text>
                                    <Form.Control type="password" placeholder="Confirmer le mot de passe" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                                </InputGroup>
                            </Form.Group>
                        )}
                        <Button type="submit" className="w-100 btn-lg auth-submit-btn-canaan btn-primary" disabled={loading}>
                            {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : (isLogin ? 'Se connecter' : "S'inscrire")}
                        </Button>
                    </Form>
                    <div className="text-center mt-4">
                        <Button variant="link" className="text-secondary text-decoration-none small" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
                            {isLogin ? "Créer un compte entreprise" : 'J\'ai déjà un compte'}
                        </Button>
                    </div>
                </Card.Body>
            </Card>
        </Container>
    </motion.div>
  );
};


// --- COMPOSANT : Dashboard (Refonte majeure) ---
const Dashboard = () => {
    // === États ===
    const [items, setItems] = useState([]);
    const [path, setPath] = useState([{ id: null, name: 'Racine' }]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState(localStorage.getItem('viewMode') || 'list');
    const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [itemToRename, setItemToRename] = useState(null);
    const [newItemName, setNewItemName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [showViewerModal, setShowViewerModal] = useState(false);
    const [fileContent, setFileContent] = useState('');
    const [viewLoading, setViewLoading] = useState(false);
    const [fileViewer, setFileViewer] = useState(null);
    const [uploads, setUploads] = useState({});
    const [showUploadOverlay, setShowUploadOverlay] = useState(false); // Nouvel état

    // === Refs ===
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const currentFolderId = path[path.length - 1].id;

    // === Callbacks ===
    const showToast = useCallback((message, type = 'success') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    }, []);
    const dismissToast = useCallback((id) => setToasts(prev => prev.filter(toast => toast.id !== id)), []);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/browse`, { params: { parentId: currentFolderId || null } });
            const sortedItems = res.data.sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            });
            setItems(sortedItems);
        } catch (err) {
            if (err.response?.status !== 401) {
                 showToast('Erreur lors du chargement des éléments.', 'error');
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [currentFolderId, showToast]);

    const closeUploadOverlay = useCallback(() => {
        setShowUploadOverlay(false);
        setUploads(prev => {
            const remaining = {};
            Object.values(prev).forEach(u => {
                if ((u.progress >= 0 && u.progress < 100 && !u.error) || u.progress === -1) {
                    remaining[u.tempId] = u;
                }
            });
            return remaining;
        });
    }, []);

    // === Effets ===
    useEffect(() => { fetchItems(); }, [fetchItems]);
    useEffect(() => { localStorage.setItem('viewMode', viewMode); }, [viewMode]);

    // === Fonctions d'Upload (Modifiées pour Overlay) ===
    const handleFileUploadChange = (e) => {
        if (e.target.files.length > 0) {
            uploadFiles(e.target.files);
            e.target.value = null;
        }
    };
     const handleFolderUploadChange = (e) => {
        if (e.target.files.length > 0) {
            uploadFolder(e.target.files);
            e.target.value = null;
        }
    };

    const uploadFiles = async (filesToUpload) => {
        const filesArray = Array.from(filesToUpload);
        const currentUploads = {};

        filesArray.forEach(file => {
            const tempId = `upload-${Date.now()}-${Math.random()}`;
            currentUploads[tempId] = { name: file.name, progress: 0, error: null, tempId: tempId };
        });
        setUploads(prev => ({ ...prev, ...currentUploads }));
        setShowUploadOverlay(true); // Afficher l'overlay

        const formData = new FormData();
        filesArray.forEach(file => formData.append('files', file));
        if (currentFolderId) formData.append('parentId', currentFolderId);
        const tempIds = Object.keys(currentUploads);

        try {
            await api.post('/files', formData, {
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total ?? (progressEvent.loaded * 1.05);
                    const percentCompleted = total ? Math.round((progressEvent.loaded * 100) / total) : 0;
                    setUploads(prev => {
                        const updated = { ...prev };
                        tempIds.forEach(id => {
                            if (updated[id]) {
                                updated[id] = { ...updated[id], progress: Math.min(percentCompleted, 100) };
                            }
                        });
                        return updated;
                    });
                }
            });

            showToast(`${filesArray.length} élément(s) uploadé(s) !`, 'success');
            fetchItems();
             // Marquer comme terminés dans l'état (nécessaire pour l'affichage dans l'overlay)
            setUploads(prev => {
                 const updated = { ...prev };
                 tempIds.forEach(id => {
                     if (updated[id] && !updated[id].error) { // Ne pas écraser les erreurs potentielles
                         updated[id] = { ...updated[id], progress: 100 };
                     }
                 });
                 return updated;
             });

        } catch (err) {
            const errorMsg = err.response?.data?.msg || "Erreur lors de l'upload.";
            showToast(errorMsg, 'error');
            console.error("Upload error:", err);
            setUploads(prev => {
                const updated = { ...prev };
                tempIds.forEach(id => {
                    if (updated[id]) {
                        updated[id] = { ...updated[id], progress: 100, error: errorMsg };
                    }
                });
                return updated;
            });
        }
    };

    const uploadFolder = async (filesToUpload) => {
        const folderNameGuess = filesToUpload[0]?.webkitRelativePath?.split('/')[0] || 'Dossier';
        const tempId = `upload-folder-${Date.now()}`;
        setUploads(prev => ({
            ...prev,
            [tempId]: { name: `Dossier: ${folderNameGuess}`, progress: -1, error: null, tempId: tempId }
        }));
        setShowUploadOverlay(true); // Afficher l'overlay

        const formData = new FormData();
        const paths = [];
        Array.from(filesToUpload).forEach(file => {
            formData.append('files', file);
            paths.push(file.webkitRelativePath || file.name);
        });
        formData.append('paths', JSON.stringify(paths));
        if (currentFolderId) formData.append('rootParentId', currentFolderId);

        try {
            await api.post('/upload-folder', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast('Dossier uploadé avec succès !', 'success');
            fetchItems();
            setUploads(prev => ({ ...prev, [tempId]: { ...prev[tempId], progress: 100 } })); // Marquer comme terminé

        } catch (err) {
            const errorMsg = err.response?.data?.msg || "Erreur lors de l'upload du dossier.";
            showToast(errorMsg, 'error');
            console.error("Folder upload error:", err);
            setUploads(prev => ({ ...prev, [tempId]: { ...prev[tempId], progress: 100, error: errorMsg } })); // Marquer comme erreur
        }
    };


    // === Drag & Drop Handlers ===
    const handleDragEvents = e => { e.preventDefault(); e.stopPropagation(); };
    const handleDragEnter = e => { handleDragEvents(e); setIsDragging(true); };
    const handleDragLeave = e => {
        handleDragEvents(e);
        if (e.relatedTarget === null || !e.currentTarget.contains(e.relatedTarget)) {
            setIsDragging(false);
        }
     };
    const handleDrop = e => {
        handleDragEvents(e);
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
            uploadFiles(e.dataTransfer.files);
        }
    };

    // === Autres Actions ===
     const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        try {
            await api.post('/folders', { name: newFolderName.trim(), parentId: currentFolderId });
            setShowCreateFolderModal(false);
            setNewFolderName('');
            fetchItems();
            showToast(`Dossier "${newFolderName.trim()}" créé !`, 'success');
        } catch(err) {
            showToast(err.response?.data?.msg || 'Erreur de création du dossier.', 'error');
            console.error("Create folder error:", err);
        }
    };

    const handleDelete = async (item) => {
        const confirmationMessage = item.type === 'folder'
            ? `Voulez-vous vraiment supprimer le dossier "${item.name}" et tout son contenu ?`
            : `Voulez-vous vraiment supprimer le fichier "${item.name}" ?`;
        if (window.confirm(`${confirmationMessage}\nCette action est irréversible.`)) {
             try {
                await api.delete(`/items/${item._id}`);
                fetchItems(); // Refresh
                showToast(`"${item.name}" a été supprimé.`, 'success');
            } catch(err) {
                showToast(err.response?.data?.msg || 'Erreur de suppression.', 'error');
                console.error("Delete error:", err);
            }
        }
    };

    const handleDownload = async (item) => {
        showToast(`Préparation du téléchargement de "${item.name}"...`, 'info');
        try {
            const url = item.type === 'file' ? `/download/file/${item._id}` : `/download/folder/${item._id}`;
            const response = await api.get(url, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = item.type === 'folder' ? `${item.name}.zip` : item.name;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100);
        } catch (err) {
            showToast(`Erreur lors du téléchargement de "${item.name}".`, "error");
            console.error("Download error:", err);
        }
    };

     const openRenameModal = (item) => {
        setItemToRename(item);
        setNewItemName(item.name);
        setShowRenameModal(true);
    };
    const handleRename = async (e) => {
        e.preventDefault();
        const trimmedNewName = newItemName.trim();
        if (!trimmedNewName || !itemToRename || trimmedNewName === itemToRename.name) {
             setShowRenameModal(false);
             return;
        }
        try {
            await api.put(`/items/${itemToRename._id}`, { newName: trimmedNewName });
            fetchItems();
            setShowRenameModal(false);
            showToast(`"${itemToRename.name}" renommé en "${trimmedNewName}".`, 'success');
        } catch (err) {
            showToast(err.response?.data?.msg || 'Erreur lors du renommage.', 'error');
            console.error("Rename error:", err);
        }
    };

     const handleViewFile = async (item) => {
        if (item.type === 'folder') return;

        setFileViewer(item);
        if (fileContent && fileContent.startsWith('blob:')) {
            URL.revokeObjectURL(fileContent);
        }
        setFileContent('');
        setViewLoading(true);
        setShowViewerModal(true);

        try {
             if (item.mimetype?.startsWith('text/') || item.mimetype === 'application/json') {
                const response = await api.get(`/file/content/${item._id}`);
                setFileContent(response.data);
            } else if (
                item.mimetype?.startsWith('image/') ||
                item.mimetype === 'application/pdf' ||
                item.mimetype?.startsWith('video/')
            ) {
                 const response = await api.get(`/download/file/${item._id}`, { responseType: 'blob' });
                 const blobUrl = URL.createObjectURL(response.data);
                 setFileContent(blobUrl);
            } else {
                setFileContent(null);
            }
        } catch (err) {
            console.error("View file error:", err);
            setFileContent('Erreur lors du chargement du contenu.');
            showToast("Erreur de chargement du contenu.", 'error');
        } finally {
            setViewLoading(false);
        }
    };

    // === Navigation ===
    const navigateTo = (folder) => {
        if (folder.type === 'folder') {
            setPath([...path, { id: folder._id, name: folder.name }]);
        } else {
            handleViewFile(folder);
        }
    };
    const navigateBreadcrumb = (index) => setPath(path.slice(0, index + 1));


    // === Render ===
    return (
    <Container fluid className="dashboard-container-canaan" onDragEnter={handleDragEnter} onDragOver={handleDragEvents} onDragLeave={handleDragLeave} onDrop={handleDrop}>

        {/* --- Drag & Drop Overlay --- */}
        <AnimatePresence>
            {isDragging && (
                 <motion.div
                    className="dropzone-overlay-canaan"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <div className="dropzone-content-canaan text-center text-white">
                        <i className="bi bi-cloud-arrow-up-fill mb-3"></i>
                        <h2 className="fw-bold">Déposez ici</h2>
                        <p className="lead">Relâchez pour uploader.</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* --- Hidden File Inputs --- */}
        <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUploadChange} />
        <input type="file" ref={folderInputRef} style={{ display: 'none' }} webkitdirectory="" mozdirectory="" directory="" onChange={handleFolderUploadChange} />

        {/* --- Action Bar --- */}
        <Row className="action-bar-canaan align-items-center mb-4">
             <Col xs={12} lg={7} className="mb-2 mb-lg-0">
                 <Breadcrumb listProps={{ className: 'custom-breadcrumb' }}>
                    {path.map((p, index) => (
                        <Breadcrumb.Item
                            key={p.id || 'racine'}
                            onClick={() => index < path.length - 1 && navigateBreadcrumb(index)}
                            active={index === path.length - 1}
                            linkProps={{ className: index < path.length - 1 ? '' : '' }}
                            style={{ cursor: index < path.length - 1 ? 'pointer' : 'default' }}
                        >
                            {p.id === null ? <i className="bi bi-house-door-fill"></i> : p.name}
                        </Breadcrumb.Item>
                    ))}
                </Breadcrumb>
            </Col>
            <Col xs={12} lg={5} className="d-flex justify-content-lg-end align-items-center">
                 {/* View Toggle */}
                 <ButtonGroup size="sm" className="me-3 shadow-sm">
                    <Button variant={viewMode === 'list' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('list')} title="Vue Liste"><i className="bi bi-list-ul"></i></Button>
                    <Button variant={viewMode === 'grid' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('grid')} title="Vue Grille"><i className="bi bi-grid-3x2-gap-fill"></i></Button>
                </ButtonGroup>
                {/* Create Folder */}
                <Button variant="outline-primary" size="sm" onClick={() => setShowCreateFolderModal(true)} className="me-2 shadow-sm">
                    <i className="bi bi-folder-plus me-1"></i> <span className="d-none d-md-inline">Nouveau Dossier</span>
                </Button>
                {/* Upload Dropdown */}
                <Dropdown>
                    <Dropdown.Toggle variant="success" size="sm" id="dropdown-upload" className="shadow-sm">
                        <i className="bi bi-upload me-1"></i> <span className="d-none d-md-inline">Uploader</span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                        <Dropdown.Item onClick={() => fileInputRef.current.click()}><i className="bi bi-file-earmark-arrow-up me-2"></i>Fichier(s)</Dropdown.Item>
                        <Dropdown.Item onClick={() => folderInputRef.current.click()}><i className="bi bi-folder-symlink me-2"></i>Dossier</Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </Col>
        </Row>

        {/* --- Content Area --- */}
         <motion.div layout className="content-area-canaan"> {/* Animation layout sur la zone */}
            {loading ? (
                <div className="text-center p-5">
                    <Spinner animation="border" variant="primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                        <span className="visually-hidden">Chargement...</span>
                    </Spinner>
                    <p className="mt-3 text-muted">Chargement des éléments...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="empty-folder-indicator-canaan text-center p-5">
                    <i className="bi bi-folder2-open"></i>
                    <h4 className="mt-3">Ce dossier est vide</h4>
                    <p className="text-secondary small">Glissez-déposez ou uploadez pour ajouter du contenu.</p>
                </div>
            ) : (
                <AnimatePresence initial={false}> {/* Mieux gérer les animations d'entrée/sortie */}
                    {viewMode === 'grid' ? (
                        <motion.div
                            layout // Important pour animer le changement de layout
                            className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 row-cols-xl-6 g-3"
                         >
                            {items.map((item) => (
                                <Col key={item._id} className="grid-item-col">
                                     <motion.div
                                        layout="position" // Animer seulement la position, pas la taille/opacité ici
                                        key={item._id} // La clé est cruciale ici pour AnimatePresence
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20, duration: 0.2 }}
                                    >
                                        <Card className="grid-item-canaan h-100 text-center" onClick={() => navigateTo(item)}>
                                            <Card.Body>
                                                 <div className="item-icon-canaan mb-2"><FileIcon type={item.type} mimetype={item.mimetype} /></div>
                                                <Card.Text className="item-name-canaan small text-truncate w-100" title={item.name}>{item.name}</Card.Text>
                                            </Card.Body>
                                             <Card.Footer>
                                                <ButtonGroup size="sm">
                                                    <Button variant="outline-primary" onClick={(e) => { e.stopPropagation(); handleDownload(item); }} title="Télécharger"><i className="bi bi-download"></i></Button>
                                                    {item.type === 'file' && <Button variant="outline-info" onClick={(e) => { e.stopPropagation(); handleViewFile(item); }} title="Voir"><i className="bi bi-eye"></i></Button>}
                                                    <Button variant="outline-secondary" onClick={(e) => { e.stopPropagation(); openRenameModal(item); }} title="Renommer"><i className="bi bi-pencil"></i></Button>
                                                    <Button variant="outline-danger" onClick={(e) => { e.stopPropagation(); handleDelete(item); }} title="Supprimer"><i className="bi bi-trash"></i></Button>
                                                </ButtonGroup>
                                             </Card.Footer>
                                        </Card>
                                    </motion.div>
                                </Col>
                            ))}
                        </motion.div>
                    ) : ( // List View
                         <motion.div layout className="file-list-canaan"> {/* Animation layout */}
                             <ListGroup variant="flush">
                                <ListGroup.Item className="d-none d-md-flex list-group-header">
                                    <Col md={6}>Nom</Col>
                                    <Col md={2} className="d-none d-lg-block">Type</Col> {/* Masquer type sur md */}
                                    <Col md={2}>Créé le</Col>
                                    <Col md={2} className="text-end">Actions</Col> {/* Alignement droite */}
                                </ListGroup.Item>
                                {items.map((item) => (
                                     <motion.div
                                        layout="position"
                                        key={item._id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                    <ListGroup.Item action onClick={() => navigateTo(item)} className="list-item-canaan">
                                        <Row className="w-100 align-items-center gx-2"> {/* gx réduit gouttière */}
                                            <Col xs={10} md={6} className="text-truncate d-flex align-items-center">
                                                <span className="me-2 list-icon-canaan"><FileIcon type={item.type} mimetype={item.mimetype} /></span>
                                                <span className="item-name-list fw-medium" title={item.name}>{item.name}</span>
                                            </Col>
                                            <Col md={2} className="d-none d-lg-block text-muted small text-truncate"> {/* Masquer type sur md */}
                                                {item.type === 'folder' ? 'Dossier' : (item.mimetype || 'Fichier')}
                                            </Col>
                                             <Col xs={2} md={2} className="text-muted small text-end text-md-start"> {/* Date prend moins de place */}
                                                {new Date(item.createdAt).toLocaleDateString()}
                                            </Col>
                                             <Col xs={12} md={2} className="text-md-end item-actions-list mt-2 mt-md-0"> {/* Actions prennent toute la largeur sur xs */}
                                                <ButtonGroup size="sm">
                                                     <Button variant="outline-primary" onClick={(e) => { e.stopPropagation(); handleDownload(item); }} title="Télécharger"><i className="bi bi-download"></i></Button>
                                                     {item.type === 'file' && <Button variant="outline-info" onClick={(e) => { e.stopPropagation(); handleViewFile(item); }} title="Voir"><i className="bi bi-eye"></i></Button>}
                                                    <Button variant="outline-secondary" onClick={(e) => { e.stopPropagation(); openRenameModal(item); }} title="Renommer"><i className="bi bi-pencil"></i></Button>
                                                    <Button variant="outline-danger" onClick={(e) => { e.stopPropagation(); handleDelete(item); }} title="Supprimer"><i className="bi bi-trash"></i></Button>
                                                </ButtonGroup>
                                            </Col>
                                        </Row>
                                    </ListGroup.Item>
                                    </motion.div>
                                ))}
                            </ListGroup>
                        </motion.div>
                    )}
                 </AnimatePresence>
            )}
        </motion.div> {/* Fin motion.div content-area */}

         {/* --- Overlay d'Uploads (Utilisation) --- */}
        <AnimatePresence>
            {showUploadOverlay && Object.keys(uploads).length > 0 && (
                <UploadOverlay uploads={uploads} onClose={closeUploadOverlay} />
            )}
        </AnimatePresence>

        {/* --- Toast Container --- */}
        <div className="toast-container-canaan position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
             <AnimatePresence>
                {toasts.map(toast => <Toast key={toast.id} {...toast} onDismiss={() => dismissToast(toast.id)} />)}
            </AnimatePresence>
        </div>


        {/* --- Modals (Stylées via CSS) --- */}
        <Modal show={showCreateFolderModal} onHide={() => setShowCreateFolderModal(false)} centered>
             <Modal.Header closeButton><Modal.Title><i className="bi bi-folder-plus me-2 text-primary"></i>Créer un dossier</Modal.Title></Modal.Header>
             <Form onSubmit={handleCreateFolder}>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Nom du dossier</Form.Label>
                        <Form.Control type="text" placeholder="Ex: Rapports Annuels" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} autoFocus required />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCreateFolderModal(false)}>Annuler</Button>
                    <Button variant="primary" type="submit" disabled={!newFolderName.trim()}>Créer</Button>
                </Modal.Footer>
             </Form>
        </Modal>

        <Modal show={showRenameModal} onHide={() => setShowRenameModal(false)} centered>
             <Modal.Header closeButton><Modal.Title><i className="bi bi-pencil-square me-2 text-secondary"></i>Renommer</Modal.Title></Modal.Header>
             <Form onSubmit={handleRename}>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Nouveau nom pour "{itemToRename?.name}"</Form.Label>
                        <Form.Control type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} autoFocus required />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRenameModal(false)}>Annuler</Button>
                    <Button variant="primary" type="submit" disabled={!newItemName.trim() || newItemName.trim() === itemToRename?.name}>Renommer</Button>
                </Modal.Footer>
             </Form>
        </Modal>

        <Modal
            show={showViewerModal}
            onHide={() => {
                setShowViewerModal(false);
                if (fileContent && fileContent.startsWith('blob:')) { URL.revokeObjectURL(fileContent); }
            }}
            size="xl" centered fullscreen="lg-down" dialogClassName="viewer-modal-dialog" // Class pour cibler
        >
             <Modal.Header closeButton>
                <Modal.Title className="d-flex align-items-center text-truncate">
                    <span className="me-2 list-icon-canaan"><FileIcon type={fileViewer?.type} mimetype={fileViewer?.mimetype} /></span>
                    <span className="fs-6 fw-normal">{fileViewer?.name}</span> {/* Titre moins imposant */}
                </Modal.Title>
            </Modal.Header>
             <Modal.Body className="p-0 viewer-modal-body d-flex flex-column"> {/* Flex pour remplir l'espace */}
                {viewLoading ? (
                    <div className="d-flex justify-content-center align-items-center flex-grow-1">
                        <Spinner animation="border" variant="primary" /> <span className="ms-2 text-muted">Chargement...</span>
                    </div>
                 ) : fileViewer?.mimetype?.startsWith('image/') ? (
                    <div className="text-center p-3 viewer-content flex-grow-1 d-flex align-items-center justify-content-center">
                        <img src={fileContent} alt={fileViewer.name} className="img-fluid rounded" style={{ maxHeight: 'calc(100vh - 140px)', objectFit: 'contain' }} />
                    </div>
                 ) : fileViewer?.mimetype === 'application/pdf' ? (
                     <iframe src={fileContent} title={fileViewer.name} className="border-0 flex-grow-1"></iframe>
                 ) : fileViewer?.mimetype?.startsWith('video/') ? (
                    <div className="text-center p-0 d-flex justify-content-center align-items-center flex-grow-1" style={{ backgroundColor: '#000' }}>
                        <video src={fileContent} controls autoPlay muted loop style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 140px)' }}>
                            Votre navigateur ne supporte pas la balise vidéo.
                        </video>
                    </div>
                ) : fileViewer?.mimetype?.startsWith('text/') || fileViewer?.mimetype === 'application/json' ? (
                     <div className="p-3 viewer-content flex-grow-1" style={{ overflowY: 'auto' }}>
                         <pre className="text-content-viewer bg-light p-3 rounded font-monospace small">{fileContent}</pre>
                     </div>
                 ) : (
                     <div className="text-center p-5 text-muted d-flex flex-column justify-content-center align-items-center flex-grow-1">
                        {fileContent === 'Erreur lors du chargement du contenu.' ? (
                            <>
                                <i className="bi bi-exclamation-triangle-fill display-3 text-danger opacity-75 mb-3"></i>
                                <p className="fs-6">{fileContent}</p>
                            </>
                        ) : (
                            <>
                                <i className="bi bi-file-earmark-lock display-3 opacity-50 mb-3"></i>
                                <p>Aperçu non disponible pour ce type de fichier.</p>

                                <p className="small">({fileViewer?.mimetype || 'inconnu'})</p>
                            </>
                        )}
                        <Button variant="primary" onClick={() => fileViewer && handleDownload(fileViewer)} className="mt-3"><i className="bi bi-download me-2"></i> Télécharger</Button>
                    </div>
                )}
            </Modal.Body>
             <Modal.Footer>
                 <Button variant="secondary" onClick={() => setShowViewerModal(false)}>Fermer</Button>
                 {fileViewer && <Button variant="primary" onClick={() => handleDownload(fileViewer)}><i className="bi bi-download me-2"></i> Télécharger</Button>}
            </Modal.Footer>
        </Modal>

    </Container>
    );
};

export default App;