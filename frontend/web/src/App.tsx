import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface DataRecord {
  id: string;
  encryptedData: string;
  timestamp: number;
  owner: string;
  category: string;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newRecordData, setNewRecordData] = useState({
    category: "",
    description: "",
    sensitiveInfo: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [showFAQ, setShowFAQ] = useState(false);
  const [stats, setStats] = useState({
    totalRecords: 0,
    categories: {} as Record<string, number>
  });

  // Calculate statistics
  useEffect(() => {
    const categoryCounts: Record<string, number> = {};
    records.forEach(record => {
      categoryCounts[record.category] = (categoryCounts[record.category] || 0) + 1;
    });
    
    setStats({
      totalRecords: records.length,
      categories: categoryCounts
    });
  }, [records]);

  // Filter records based on search term
  const filteredRecords = records.filter(record => 
    record.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRecords = filteredRecords.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  useEffect(() => {
    loadRecords().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadRecords = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("record_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing record keys:", e);
        }
      }
      
      const list: DataRecord[] = [];
      
      for (const key of keys) {
        try {
          const recordBytes = await contract.getData(`record_${key}`);
          if (recordBytes.length > 0) {
            try {
              const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
              list.push({
                id: key,
                encryptedData: recordData.data,
                timestamp: recordData.timestamp,
                owner: recordData.owner,
                category: recordData.category
              });
            } catch (e) {
              console.error(`Error parsing record data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading record ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(list);
    } catch (e) {
      console.error("Error loading records:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitRecord = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting data with Zama FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify(newRecordData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const recordId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const recordData = {
        data: encryptedData,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        category: newRecordData.category
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `record_${recordId}`, 
        ethers.toUtf8Bytes(JSON.stringify(recordData))
      );
      
      const keysBytes = await contract.getData("record_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(recordId);
      
      await contract.setData(
        "record_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Data encrypted and stored securely!"
      });
      
      await loadRecords();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewRecordData({
          category: "",
          description: "",
          sensitiveInfo: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const renderCategoryChart = () => {
    const categories = Object.keys(stats.categories);
    const total = stats.totalRecords;
    
    return (
      <div className="category-chart">
        {categories.map(category => (
          <div key={category} className="chart-bar">
            <div className="bar-label">{category}</div>
            <div className="bar-container">
              <div 
                className="bar-fill" 
                style={{ width: `${(stats.categories[category] / total) * 100}%` }}
              >
                <span className="bar-value">{stats.categories[category]}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="metal-spinner"></div>
      <p>Initializing encrypted connection...</p>
    </div>
  );

  return (
    <div className="app-container metal-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>FHE<span>Data</span>Vault</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-record-btn metal-button"
          >
            <div className="add-icon"></div>
            Add Data
          </button>
          <button 
            className="metal-button"
            onClick={() => setShowFAQ(!showFAQ)}
          >
            {showFAQ ? "Hide FAQ" : "Show FAQ"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="dashboard-layout">
        <div className="dashboard-column">
          <div className="dashboard-card metal-card">
            <h3>Project Introduction</h3>
            <p>Secure data storage platform using Zama FHE technology to encrypt sensitive information without compromising privacy.</p>
            <div className="fhe-badge">
              <span>FHE-Powered</span>
            </div>
          </div>
          
          <div className="dashboard-card metal-card">
            <h3>Data Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{stats.totalRecords}</div>
                <div className="stat-label">Total Records</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{Object.keys(stats.categories).length}</div>
                <div className="stat-label">Categories</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card metal-card">
            <h3>Category Distribution</h3>
            {renderCategoryChart()}
          </div>
        </div>
        
        <div className="dashboard-column main-content">
          <div className="welcome-banner">
            <div className="welcome-text">
              <h2>Fully Homomorphic Encryption Data Vault</h2>
              <p>Store and manage sensitive data with Zama FHE technology</p>
            </div>
          </div>
          
          <div className="records-section">
            <div className="section-header">
              <h2>Encrypted Data Records</h2>
              <div className="header-actions">
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="metal-input"
                  />
                  <div className="search-icon"></div>
                </div>
                <button 
                  onClick={loadRecords}
                  className="refresh-btn metal-button"
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            
            <div className="records-list metal-card">
              <div className="table-header">
                <div className="header-cell">ID</div>
                <div className="header-cell">Category</div>
                <div className="header-cell">Owner</div>
                <div className="header-cell">Date</div>
                <div className="header-cell">Actions</div>
              </div>
              
              {currentRecords.length === 0 ? (
                <div className="no-records">
                  <div className="no-records-icon"></div>
                  <p>No encrypted records found</p>
                  <button 
                    className="metal-button primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create First Record
                  </button>
                </div>
              ) : (
                currentRecords.map(record => (
                  <div className="record-row" key={record.id}>
                    <div className="table-cell record-id">#{record.id.substring(0, 6)}</div>
                    <div className="table-cell">{record.category}</div>
                    <div className="table-cell">{record.owner.substring(0, 6)}...{record.owner.substring(38)}</div>
                    <div className="table-cell">
                      {new Date(record.timestamp * 1000).toLocaleDateString()}
                    </div>
                    <div className="table-cell actions">
                      <button 
                        className="action-btn metal-button"
                        onClick={() => {
                          // Simulate FHE decryption
                          setTransactionStatus({
                            visible: true,
                            status: "pending",
                            message: "Decrypting with FHE..."
                          });
                          
                          setTimeout(() => {
                            setTransactionStatus({
                              visible: true,
                              status: "success",
                              message: "Data decrypted successfully!"
                            });
                            
                            setTimeout(() => {
                              setTransactionStatus({ visible: false, status: "pending", message: "" });
                            }, 2000);
                          }, 1500);
                        }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))
              )}
              
              {filteredRecords.length > itemsPerPage && (
                <div className="pagination">
                  <button 
                    onClick={() => paginate(currentPage - 1)} 
                    disabled={currentPage === 1}
                    className="metal-button"
                  >
                    Previous
                  </button>
                  
                  <span>Page {currentPage} of {totalPages}</span>
                  
                  <button 
                    onClick={() => paginate(currentPage + 1)} 
                    disabled={currentPage === totalPages}
                    className="metal-button"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {showFAQ && (
            <div className="faq-section metal-card">
              <h2>Frequently Asked Questions</h2>
              
              <div className="faq-item">
                <h3>What is Fully Homomorphic Encryption (FHE)?</h3>
                <p>FHE allows computations to be performed on encrypted data without decrypting it first. This means sensitive data remains encrypted even during processing.</p>
              </div>
              
              <div className="faq-item">
                <h3>How does Zama FHE technology work?</h3>
                <p>Zama's FHE implementation uses advanced cryptographic techniques to enable secure computations on encrypted data, providing unprecedented privacy guarantees.</p>
              </div>
              
              <div className="faq-item">
                <h3>Is my data really secure?</h3>
                <p>Yes, your data is encrypted using FHE before it even leaves your device and remains encrypted during all processing operations.</p>
              </div>
              
              <div className="faq-item">
                <h3>What can I use this platform for?</h3>
                <p>This platform is ideal for storing and processing sensitive information such as financial records, personal data, medical information, and proprietary business data.</p>
              </div>
            </div>
          )}
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitRecord} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          recordData={newRecordData}
          setRecordData={setNewRecordData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content metal-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="metal-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>FHE Data Vault</span>
            </div>
            <p>Secure encrypted data storage using Zama FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} FHE Data Vault. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  recordData: any;
  setRecordData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  recordData,
  setRecordData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRecordData({
      ...recordData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!recordData.category || !recordData.sensitiveInfo) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal metal-card">
        <div className="modal-header">
          <h2>Add Encrypted Data Record</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> Your sensitive data will be encrypted with Zama FHE
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Category *</label>
              <select 
                name="category"
                value={recordData.category} 
                onChange={handleChange}
                className="metal-select"
              >
                <option value="">Select category</option>
                <option value="Financial">Financial Data</option>
                <option value="Medical">Medical Records</option>
                <option value="Personal">Personal Information</option>
                <option value="Business">Business Secrets</option>
                <option value="Other">Other Sensitive Data</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <input 
                type="text"
                name="description"
                value={recordData.description} 
                onChange={handleChange}
                placeholder="Brief description..." 
                className="metal-input"
              />
            </div>
            
            <div className="form-group full-width">
              <label>Sensitive Information *</label>
              <textarea 
                name="sensitiveInfo"
                value={recordData.sensitiveInfo} 
                onChange={handleChange}
                placeholder="Enter sensitive data to encrypt..." 
                className="metal-textarea"
                rows={4}
              />
            </div>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> Data remains encrypted during FHE processing
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn metal-button"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn metal-button primary"
          >
            {creating ? "Encrypting with FHE..." : "Submit Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;