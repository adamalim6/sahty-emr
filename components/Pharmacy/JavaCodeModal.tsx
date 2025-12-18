import React, { useState } from 'react';
import { X, Copy, Check, FileCode } from 'lucide-react';

interface JavaCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const JAVA_FILES = {
  'InventoryItem.java': `package com.pharmacy.inventory;

import java.time.LocalDate;

public class InventoryItem {
    private String id;        // Unique Line ID (e.g. INV-1001)
    private String productId; // Product SKU (e.g. PROD-005)
    private String name;
    private String category;
    private String location;
    private String batchNumber;
    private int theoreticalQty;
    private Integer actualQty; // Nullable to represent "not counted"
    private double unitPrice;
    private LocalDate expiryDate;

    public InventoryItem(String id, String productId, String name, String category, int theoreticalQty, double unitPrice) {
        this.id = id;
        this.productId = productId;
        this.name = name;
        this.category = category;
        this.theoreticalQty = theoreticalQty;
        this.unitPrice = unitPrice;
        this.actualQty = null;
    }

    public int getVariance() {
        if (actualQty == null) return 0;
        return actualQty - theoreticalQty;
    }

    public double getVarianceValue() {
        return getVariance() * unitPrice;
    }

    // Getters and Setters
    public String getId() { return id; }
    public String getProductId() { return productId; }
    public String getName() { return name; }
    public String getBatchNumber() { return batchNumber; }
    public void setBatchNumber(String batch) { this.batchNumber = batch; }
    
    public Integer getActualQty() { return actualQty; }
    public int getTheoreticalQty() { return theoreticalQty; }
    
    public void setTheoreticalQty(int theoreticalQty) {
        this.theoreticalQty = theoreticalQty;
    }

    public void setActualQty(Integer actualQty) {
        if (actualQty != null && actualQty < 0) throw new IllegalArgumentException("Quantity cannot be negative");
        this.actualQty = actualQty;
    }
    
    @Override
    public String toString() {
        return String.format("Item[%s]: %s (Batch: %s) - Sys: %d, Act: %d", id, name, batchNumber, theoreticalQty, actualQty);
    }
}`,
  'InventoryManager.java': `package com.pharmacy.inventory;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class InventoryManager {
    private List<InventoryItem> items;

    public InventoryManager() {
        this.items = new ArrayList<>();
    }

    public void addItem(InventoryItem item) {
        this.items.add(item);
    }

    public void updateCount(String itemId, int actualQty) {
        items.stream()
            .filter(i -> i.getId().equals(itemId))
            .findFirst()
            .ifPresent(item -> item.setActualQty(actualQty));
    }

    // Logic to commit actual counts to system stock
    public void validateInventory() {
        List<InventoryItem> itemsToUpdate = items.stream()
            .filter(i -> i.getActualQty() != null)
            .collect(Collectors.toList());
            
        if (itemsToUpdate.isEmpty()) {
            System.out.println("No items counted to validate.");
            return;
        }

        System.out.println("Validating inventory for " + itemsToUpdate.size() + " items...");
        
        for (InventoryItem item : itemsToUpdate) {
            int oldSystemQty = item.getTheoreticalQty();
            int actualQty = item.getActualQty();
            
            // Explicit Logic: Variance = Actual - System
            int variance = actualQty - oldSystemQty;
            
            // Update Logic: New System = Old System + Variance
            int newSystemQty = oldSystemQty + variance;
            
            System.out.printf("Updating %s (Batch %s): %d + (%d) -> %d%n", 
                item.getName(), item.getBatchNumber(), oldSystemQty, variance, newSystemQty);
            
            item.setTheoreticalQty(newSystemQty);
            item.setActualQty(null); // Reset for next cycle
        }
        System.out.println("Inventory validation complete. System stock updated.");
    }

    public InventoryStats calculateStats() {
        long itemsCounted = items.stream().filter(i -> i.getActualQty() != null).count();
        double totalVarianceValue = items.stream()
            .filter(i -> i.getActualQty() != null)
            .mapToDouble(InventoryItem::getVarianceValue)
            .sum();

        return new InventoryStats(items.size(), itemsCounted, totalVarianceValue);
    }

    public String generateDiscrepancyReport() {
        List<InventoryItem> discrepancies = items.stream()
            .filter(i -> i.getActualQty() != null && i.getVariance() != 0)
            .collect(Collectors.toList());

        StringBuilder report = new StringBuilder("=== DISCREPANCY REPORT ===\\n");
        if (discrepancies.isEmpty()) {
            report.append("No discrepancies found. Perfect count!\\n");
        } else {
            for (InventoryItem item : discrepancies) {
                report.append(String.format("%s (%s): Expected %d, Found %d (Var: %d)\\n", 
                    item.getName(), 
                    item.getBatchNumber(),
                    item.getTheoreticalQty(), 
                    item.getActualQty(), 
                    item.getVariance()));
            }
        }
        return report.toString();
    }
}`,
  'Main.java': `package com.pharmacy.inventory;

public class Main {
    public static void main(String[] args) {
        System.out.println("Starting PharmaCount Java System...");
        
        InventoryManager manager = new InventoryManager();
        
        // Initialize Mock Data (Theoretical Stock)
        // Two batches of Amoxicillin
        InventoryItem item1 = new InventoryItem("INV-1001", "PROD-001", "Amoxicillin 500mg", "Antibiotics", 129, 0.15);
        item1.setBatchNumber("BAT-1000");
        manager.addItem(item1);

        InventoryItem item2 = new InventoryItem("INV-1002", "PROD-001", "Amoxicillin 500mg", "Antibiotics", 50, 0.15);
        item2.setBatchNumber("BAT-1001");
        manager.addItem(item2);

        manager.addItem(new InventoryItem("INV-1003", "PROD-002", "Paracetamol 1g IV", "Analgesics", 50, 2.50));
        
        // Simulate User Input (Inventory Count)
        System.out.println("Inputting counts...");
        
        // Correcting batch 1
        manager.updateCount("INV-1001", 100); 
        // Correcting batch 2
        manager.updateCount("INV-1002", 48); 
        
        // Generate Report (Pre-Validation)
        System.out.println(manager.generateDiscrepancyReport());
        
        // Commit/Validate Inventory
        manager.validateInventory();
    }
}`
};

export const JavaCodeModal: React.FC<JavaCodeModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<keyof typeof JAVA_FILES>('InventoryItem.java');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JAVA_FILES[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-slate-700">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600/20 p-2 rounded-lg">
              <FileCode className="text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Java Project Source</h3>
              <p className="text-xs text-slate-400">Generated from current inventory logic</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900 px-6 pt-4 space-x-2">
          {Object.keys(JAVA_FILES).map((fileName) => (
            <button
              key={fileName}
              onClick={() => setActiveTab(fileName as keyof typeof JAVA_FILES)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
                activeTab === fileName 
                  ? 'text-blue-400 bg-slate-800 border-t border-x border-slate-700' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {fileName}
              {activeTab === fileName && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 translate-y-[1px]"></div>
              )}
            </button>
          ))}
        </div>

        {/* Code Area */}
        <div className="flex-1 overflow-auto bg-slate-950 p-6 relative group">
          <button 
            onClick={handleCopy}
            className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-2 transition-all opacity-0 group-hover:opacity-100 border border-slate-700"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
          <pre className="font-mono text-sm leading-relaxed text-slate-300">
            {JAVA_FILES[activeTab]}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700 text-sm"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};