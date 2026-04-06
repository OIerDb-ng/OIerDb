import { Select } from '@mantine/core';
import { provinces } from '@oierdb/parser';

interface ProvinceSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
}

const data = [{ value: '', label: '全国' }, ...provinces.map((p) => ({ value: p, label: p }))];

export const ProvinceSelect: React.FC<ProvinceSelectProps> = ({ value, onChange, label }) => {
  return (
    <Select
      label={label}
      data={data}
      value={value ?? ''}
      onChange={(v) => onChange(v || null)}
      clearable={false}
    />
  );
};
