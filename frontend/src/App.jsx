import React, { useState, useEffect } from 'react';
import { Table, Card, Statistic, Row, Col, Tag, Button, Progress, Empty, Spin } from 'antd';
import { ReloadOutlined, BarChartOutlined } from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function barColor(pct) {
  if (pct >= 20) return '#cf1322';
  if (pct >= 10) return '#fa8c16';
  return '#1677ff';
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div style={{
        background: '#fff', border: '1px solid #e8e8e8',
        borderRadius: 6, padding: '8px 12px', fontSize: 12
      }}>
        <div><strong>{d.feature_name}</strong></div>
        <div style={{ color: '#666' }}>Значение: {d.feature_value ?? '—'}</div>
        <div style={{ color: '#666' }}>
          Вер. фрода: {d.fraud_pred_proba != null ? `${Number(d.fraud_pred_proba * 100).toFixed(1)}%` : '—'}
        </div>
        <div style={{ color: barColor(d.contribution_pct) }}>
          Вклад SHAP: {Number(d.contribution_pct).toFixed(2)}%
        </div>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [operations, setOperations] = useState([]);
  const [selectedOp, setSelectedOp] = useState(null);
  const [shapData, setShapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [opsRes, dashRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/operations`),
        axios.get(`${API_BASE_URL}/dashboard`)
      ]);
      setOperations(opsRes.data);
      setDashboard(dashRes.data);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const loadOperationDetails = async (record) => {
    setSelectedOp(record);
    setShapData([]);
    setReport(null);
    setDetailsLoading(true);
    setReportLoading(true);
    try {
      const [detailRes, reportRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/operation/${record.transaction_id}`),
        axios.get(`${API_BASE_URL}/report/${record.transaction_id}`)
      ]);
      setShapData(Array.isArray(detailRes.data) ? detailRes.data : []);
      const rd = reportRes.data ?? {};

      const cleanText = (val) => {
        if (!val) return '';
        const s = String(val).trim();
        const m = s.match(/^\{['"]text['"]\s*:\s*['""]([\s\S]+)['"]\s*\}$/);
        return m ? m[1] : s;
      };

      const opReport = cleanText(rd.operator_report);
      const clMsg    = cleanText(rd.client_message);
      setReport(opReport ? { ...rd, operator_report: opReport, client_message: clMsg } : null);
    } catch (err) {
      console.error('Ошибка загрузки деталей:', err);
    }
    setDetailsLoading(false);
    setReportLoading(false);
  };

  // ── Колонки левой таблицы ──────────────────────────────────────────────────
  const operationsColumns = [
    {
      title: 'ID операции',
      dataIndex: 'transaction_id',
      width: 150,
      render: (text) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{text?.slice(0, 12)}…</span>
      )
    },
    {
      title: 'Дата',
      dataIndex: 'transaction_ts',
      width: 155,
      render: (date) => date ? new Date(date).toLocaleString('ru-RU') : '—'
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      width: 90,
      render: (amount) => `${Number(amount).toFixed(2)} $`,
      sorter: (a, b) => (a.amount || 0) - (b.amount || 0)
    },
    {
      title: 'Категория',
      dataIndex: 'category',
      width: 130,
      render: (cat) => <Tag color="blue">{cat}</Tag>
    },
    {
      title: 'Вероятность фрода',
      dataIndex: 'fraud_probability',
      width: 150,
      render: (prob) => (
        <Progress
          percent={Math.round((prob || 0) * 100)}
          size="small"
          status={prob > 0.7 ? 'exception' : 'active'}
          format={(percent) => `${percent}%`}
        />
      ),
      sorter: (a, b) => (a.fraud_probability || 0) - (b.fraud_probability || 0)
    }
  ];

  // ── Колонки таблицы деталей ────────────────────────────────────────────────
  const detailColumns = [
    {
      title: 'Признак',
      dataIndex: 'feature_name',
      key: 'feature_name',
      width: '35%',
      render: (text) => <strong style={{ fontSize: 12 }}>{text}</strong>
    },
    {
      title: 'Значение',
      dataIndex: 'feature_value',
      key: 'feature_value',
      width: '30%',
      render: (val) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {val !== null && val !== undefined ? val : '—'}
        </span>
      )
    },
    {
      title: 'Вклад SHAP (%)',
      dataIndex: 'contribution_pct',
      key: 'contribution_pct',
      width: '25%',
      align: 'right',
      defaultSortOrder: 'descend',
      sorter: (a, b) => (a.contribution_pct || 0) - (b.contribution_pct || 0),
      render: (pct) => (
        <span style={{ fontWeight: 'bold', color: barColor(pct) }}>
          {Number(pct).toFixed(2)}%
        </span>
      )
    },
    {
      title: 'Вер. фрода',
      dataIndex: 'fraud_pred_proba',
      key: 'fraud_pred_proba',
      width: '20%',
      align: 'right',
      render: (val) => (
        <span style={{ fontSize: 12 }}>
          {val != null ? `${Number(val * 100).toFixed(1)}%` : '—'}
        </span>
      )
    }
  ];

  const fraudProb = selectedOp?.fraud_probability ?? 0;
  const fraudPct  = Math.round(fraudProb * 100);

  return (
    // minHeight вместо height — страница теперь скроллится целиком
    <div style={{ minHeight: '100vh', width: '100%', minWidth: 1100, background: '#f0f2f5' }}>

      {/* Шапка */}
      <div style={{
        background: '#001529', color: 'white', padding: '0 24px',
        height: 56, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100
      }}>
        <h3 style={{ color: 'white', margin: 0, fontSize: 18 }}>
          ⚠️ Система обнаружения фрода
        </h3>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          Обновить
        </Button>
      </div>

      {/* Метрики */}
      <div style={{ padding: '12px 24px', background: 'white', borderBottom: '1px solid #e8e8e8' }}>
        <Row gutter={[16, 16]}>
          <Col span={5}>
            <Statistic title="Всего операций" value={dashboard?.total_operations ?? 0} />
          </Col>
          <Col span={5}>
            <Statistic
              title="Подозрительные операции"
              value={dashboard?.suspicious_operations ?? 0}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="Доля фрода (по кол-ву)"
              value={
                dashboard?.total_operations
                  ? ((dashboard.suspicious_operations / dashboard.total_operations) * 100).toFixed(1)
                  : 0
              }
              suffix="%"
            />
          </Col>
          <Col span={5}>
            <Statistic title="Сумма фрода" value={dashboard?.fraud_sum ?? 0} suffix="$" />
          </Col>
          <Col span={4}>
            <Statistic title="Доля суммы фрода" value={dashboard?.fraud_sum_share ?? 0} suffix="%" />
          </Col>
        </Row>
      </div>

      {/* Основной контент — два столбца, оба растут по содержимому */}
      <div style={{ display: 'flex', gap: 16, padding: '16px 24px', alignItems: 'flex-start' }}>

        {/* Левый столбец: таблица операций */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card
            title={`Подозрительные операции (${operations.length})`}
            size="small"
            bodyStyle={{ padding: 0 }}
          >
            <Table
              columns={operationsColumns}
              dataSource={operations}
              rowKey="transaction_id"
              onRow={(record) => ({
                onClick: () => loadOperationDetails(record),
                style: {
                  cursor: 'pointer',
                  background: selectedOp?.transaction_id === record.transaction_id ? '#e6f4ff' : undefined
                }
              })}
              pagination={{
                defaultPageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Всего ${total} операций`,
                pageSizeOptions: [10, 20, 50, 100]
              }}
              size="middle"
              loading={loading}
            // без scroll.y — таблица растёт и страница скроллится
            />
          </Card>
        </div>

        {/* Правый столбец: детали + SHAP + справка */}
        <div style={{ width: 520, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Детали операции */}
          <Card title="Детали операции" size="small" bodyStyle={{ padding: 0 }}>
            {detailsLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spin tip="Загрузка..." /></div>
            ) : shapData.length > 0 ? (
              <Table
                columns={detailColumns}
                dataSource={shapData}
                rowKey={(row, i) => `${row.feature_name}_${i}`}
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="Нажмите на операцию для просмотра деталей"
                image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '20px 0' }} />
            )}
          </Card>

          {/* Бар-чарт SHAP */}
          <Card
            title={<span><BarChartOutlined style={{ marginRight: 8 }} />Вклад фич в решение модели (SHAP)</span>}
            size="small"
          >
            {detailsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="Загрузка SHAP вкладов..." /></div>
            ) : shapData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={shapData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="feature_name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tickFormatter={(v) => `${Number(v).toFixed(0)}%`} tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="contribution_pct" radius={[3, 3, 0, 0]}>
                    {shapData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={barColor(entry.contribution_pct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty
                description={selectedOp ? 'Нет положительных SHAP вкладов' : 'Нажмите на операцию'}
                image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '40px 0' }} />
            )}
          </Card>

          {/* Аналитическая справка */}
          {selectedOp && (
            <Card
              title="📊 Аналитическая справка"
              size="small"
              bodyStyle={{ padding: '14px 16px' }}
            >
              {/* Статус-плашка — всегда видна */}
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: fraudProb > 0.7 ? '#fff1f0' : '#f6ffed',
                borderLeft: `4px solid ${fraudProb > 0.7 ? '#ff4d4f' : '#52c41a'}`
              }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  Операция признана{' '}
                  <strong>{fraudProb > 0.7 ? 'фродовой' : 'легитимной'}</strong>{' '}
                  с вероятностью <strong>{fraudPct}%</strong>.
                </div>
                <div style={{ fontSize: 12, color: fraudProb > 0.7 ? '#cf1322' : '#389e0d' }}>
                  {fraudProb > 0.7
                    ? '⚠️ Рекомендуется блокировка и дополнительная проверка.'
                    : '✅ Операция не требует блокировки, рекомендуется мониторинг.'}
                </div>
              </div>

              {/* Тело справки */}
              {reportLoading ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Spin size="small" tip="Загрузка справки..." />
                </div>
              ) : report ? (
                <>
                  {/* ── Блок 1: Аналитика для оператора ── */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 8, paddingBottom: 6,
                      borderBottom: '1px solid #f0f0f0'
                    }}>
                      <span style={{ fontSize: 16 }}>🔍</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: '#262626',
                        textTransform: 'uppercase', letterSpacing: '0.06em'
                      }}>
                        Аналитика для оператора
                      </span>
                    </div>
                    <div style={{
                      fontSize: 13, lineHeight: 1.7, color: '#434343',
                      background: '#fafafa',
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      padding: '12px 14px',
                      whiteSpace: 'pre-wrap'   // сохраняем абзацы из LLM
                    }}>
                      {report.operator_report}
                    </div>
                  </div>

                  {/* ── Блок 2: Скрипт звонка клиенту ── */}
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 8, paddingBottom: 6,
                      borderBottom: '1px solid #e6f4ff'
                    }}>
                      <span style={{ fontSize: 16 }}>📞</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: '#0958d9',
                        textTransform: 'uppercase', letterSpacing: '0.06em'
                      }}>
                        Скрипт звонка клиенту
                      </span>
                    </div>
                    <div style={{
                      fontSize: 13, lineHeight: 1.7, color: '#262626',
                      background: '#f0f7ff',
                      border: '1px solid #bae0ff',
                      borderLeft: '4px solid #1677ff',
                      borderRadius: '0 8px 8px 0',
                      padding: '12px 14px',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {report.client_message}
                    </div>
                    {report.generated_at && (
                      <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 6, textAlign: 'right' }}>
                        Сгенерировано: {new Date(report.generated_at).toLocaleString('ru-RU')}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Empty description="Справка для этой операции не найдена"
                  image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '12px 0' }} />
              )}
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
