import axios from "axios";
import { Popconfirm } from "antd";
import "./ClearDatabaseButton.css";

function ClearDatabaseButton({ messageApi, setTables }) {
  const handleClear = async () => {
    try {
      const res = await axios.delete("http://localhost:4000/admin/clear-database");
      setTables([]);

      messageApi.success(res.data.message);
    } catch (error) {
      messageApi.error("Xóa thất bại");
    }
  };

  return (
    <Popconfirm
      title="Bạn có chắc chắn muốn xóa toàn bộ database?"
      onConfirm={handleClear}
      onCancel={() => { }}
      okText="Yes"
      cancelText="No"
      okType="primary"
      cancelButtonProps={{ danger: true }}
    >
      <button className="clear-btn">Xóa toàn bộ Items</button>
    </Popconfirm>
  );
}

export default ClearDatabaseButton;
