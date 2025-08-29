import { useState, useEffect } from "react";
import { ControlledTreeEnvironment, StaticTreeDataProvider, Tree } from "react-complex-tree";
import { Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import axios from "axios";
import "./App.css";
import ClearDatabaseButton from "./hooks/ClearDatabaseButton";

export default function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [tables, setTables] = useState([]);
  const [viewState, setViewState] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const { Dragger } = Upload;

  const preprocessData = (data) => {
    const result = {};
    for (const key in data) {
      const item = data[key];
      result[key] = {
        data: item.data,
        children: item.children || [],
        isFolder: item.isFolder || (item.children && item.children.length > 0) || false,
        hasChildren: item.isFolder || (item.children && item.children.length > 0) || false,
        index: key,
      };
    }
    return result;
  };

  const loadData = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/tree");
      const data = await res.json();

      if (data["root"]) {
        const processedData = preprocessData(data);
        const tableId = "tree-1";
        setTables([{ id: "tree-1", rootId: "root", data: processedData }]);
        
        setViewState((prev) => ({
          ...prev,
          [tableId]: {
            expandedItems: new Set(["root"]),
            selectedItems: new Set(),
          },
        }));
      } else {
        console.warn("Dữ liệu không có rootId hợp lệ");
        setTables([]);
      }
    } catch (err) {
      messageApi.error("Lỗi khi tải dữ liệu từ server.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addTable = () => {
    const newId = `tree-${tables.length + 1}`;
    const rootKey = `${newId}-root`;
    const emptyRoot = {
      [rootKey]: {
        index: rootKey,
        isFolder: true,
        children: [],
        data: `Table ${tables.length + 1}`,
      },
    };

    setTables([...tables, { id: newId, rootId: rootKey, data: emptyRoot }]);

    setViewState((prev) => ({
      ...prev,
      [newId]: {
        expandedItems: new Set([rootKey]),
        selectedItems: new Set(),
      },
    }));
  };

  const deleteTable = (id) => {
    setTables(tables.filter((table) => table.id !== id));
  };

  const props = {
    name: "file",
    multiple: false,
    action: "http://localhost:4000/upload",
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        await axios.post("http://localhost:4000/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        messageApi.success(`${file.name} đã upload thành công`);

        loadData();
        onSuccess("ok");
      } catch (err) {
        messageApi.error(`${file.name} upload thất bại`);
        onError(err);
      }
    },
  };

  const onSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const onDrop = (source, destination) => {
    if (!destination || destination.parentItem == null) {
      console.warn("targetParentId không hợp lệ");
      return;
    }

    const { treeId: sourceTreeId, itemId: draggedItemId } = source;
    const { treeId: destTreeId, parentItem: targetParentId } = destination;

    // Deep copy tables và data
    const updatedTables = tables.map((t) => ({
      ...t,
      data: { ...t.data },
    }));

    const sourceTable = updatedTables.find((t) => t.id === sourceTreeId);
    const destTable = updatedTables.find((t) => t.id === destTreeId);

    if (!sourceTable || !destTable) {
      console.warn("Không tìm thấy bảng nguồn hoặc đích");
      return;
    }

    const draggedItem = sourceTable.data[draggedItemId];

    if (!draggedItem) {
      console.warn("Không tìm thấy item kéo");
      return;
    }

    if (sourceTreeId !== destTreeId) {
      // Xóa khỏi bảng nguồn
      delete sourceTable.data[draggedItemId];
      const sourceRootChildren = sourceTable.data[sourceTable.rootId]?.children || [];
      sourceTable.data[sourceTable.rootId].children = sourceRootChildren.filter(id => id !== draggedItemId);
    } else {
      // Xóa khỏi cha cũ
      const parentEntry = Object.values(sourceTable.data).find(item => item.children?.includes(draggedItemId));
      if (parentEntry) {
        parentEntry.children = parentEntry.children.filter(id => id !== draggedItemId);
      }
    }

    if (!destTable.data[targetParentId].children) {
      destTable.data[targetParentId].children = [];
    }

    // Thêm vào bảng đích
    destTable.data[draggedItemId] = draggedItem;
    destTable.data[targetParentId].children.push(draggedItemId);

    setTables(updatedTables);
  };

  const updateViewState = (searchTerm) => {
    const allItems = tables.reduce((acc, table) => ({ ...acc, ...table.data }), {});
    const matches = Object.keys(allItems).filter((key) =>
      allItems[key].data.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const expanded = new Set();

    matches.forEach((matchId) => {
      let parent = Object.values(allItems).find((x) => x.children?.includes(matchId));
      while (parent) {
        expanded.add(parent.index);
        parent = Object.values(allItems).find((x) => x.children?.includes(parent.index));
      }
    });

    const newViewState = {};
    tables.forEach((table) => {
      newViewState[table.id] = {
        expandedItems: new Set([table.rootId, ...expanded]),
        selectedItems: new Set(),
      };
    });

    setViewState(newViewState);
  };

  useEffect(() => {
    if (searchTerm) {
      updateViewState(searchTerm);
    }
  }, [searchTerm, tables]);

  return (
    <>
      {contextHolder}

      <div>
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, alignItems: "center", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <Dragger {...props}>
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">Kéo thả file Excel vào đây</p>
            </Dragger>
          </div>

          <div style={{ marginLeft: "20px" }}>
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={onSearchChange}
              style={{
                padding: "6px 10px",
                width: "200px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>
        </div>

        <div style={{ position: "absolute", top: 0, right: 0, padding: "10px" }}>
          <ClearDatabaseButton messageApi={messageApi} setTables={setTables} />
        </div>

        <div style={{ position: "absolute", top: "100px", left: 0, right: 0, textAlign: "center", marginBottom: "20px" }}>
          <button onClick={addTable} className="addTablebutton">Thêm bảng</button>
        </div>

        {tables.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: '40px' }}>
            <div
              style={{
                border: "1px solid #ff9800",
                backgroundColor: "#fff3e0",
                color: "#ef6c00",
                padding: "20px 20px",
                borderRadius: "6px",
                fontWeight: "600",
                maxWidth: "100px",
                margin: "20px opx 20px 40px",
                textAlign: "center",
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
              }}
            >
              Đang tải dữ liệu hoặc chưa có bảng nào
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              padding: "20px",
              overflowX: "auto",
              gap: "20px",
              marginTop: "160px",
            }}
          >
            {
              tables.map((table, tableIndex) => {
                const rootData = table?.data[table.rootId];
                console.log(viewState[table.id])
                if (!rootData) {
                  return (
                    <div key={table.id} style={{ color: 'red', padding: '10px' }}>
                      Dữ liệu không hợp lệ hoặc đang tải...
                    </div>
                  );
                }

                return (
                  <ControlledTreeEnvironment
                    key={table.id}
                    items={table.data}
                    getItemTitle={(item) => item.data}
                    rootItem={table.rootId}
                    viewState={viewState[table.id] || { expandedItems: new Set([table.rootId]), selectedItems: new Set() }}
                    onViewStateChange={(newState) => {
                      console.log("New viewState:", newState);
                      setViewState((prev) => ({
                        ...prev,
                        [table.id]: newState,
                      }));
                    }}
                    onSelectItems={(items) => {
                      console.log(`Bạn đã chọn các mục:`, items);
                    }}
                    canDragAndDrop
                    canDropOnFolder
                    canReorderItems
                    onDrop={onDrop}
                  >
                    <div
                      style={{
                        border: "1px solid #ccc",
                        borderRadius: "8px",
                        padding: "5px",
                        backgroundColor: "white",
                        width: "250px",
                        position: "relative",
                        marginRight: "20px"
                      }}
                    >
                      <input
                        type="text"
                        value={table.name || (tableIndex === 0 ? "Nguyên liệu sản xuất" : `Table ${tableIndex + 1}`)}
                        onChange={(e) => {
                          const newTables = [...tables];
                          newTables[tableIndex].name = e.target.value;
                          setTables(newTables);
                        }}
                        style={{
                          width: "200px",
                          marginBottom: "5px",
                          padding: "4px 6px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          fontWeight: "bold",
                        }}
                      />

                      <button
                        onClick={() => deleteTable(table.id)}
                        style={{
                          position: "absolute",
                          top: "5px",
                          right: "5px",
                          background: "transparent",
                          border: "none",
                          borderRadius: "50%",
                          cursor: "pointer",
                          fontSize: "12px",
                          color: "#555",
                        }}
                      >
                        ×
                      </button>

                      <div className="scroll-container">
                        <Tree
                          treeId={table.id}
                          rootItem={table.rootId}
                          treeLabel={table.name || `Tree ${tableIndex + 1}`}
                          items={table.data}
                          getItemTitle={(item) => item.data}
                        />
                      </div>
                    </div>
                  </ControlledTreeEnvironment>
                );
              })}
          </div>
        )}

      </div>
    </>
  );
}
