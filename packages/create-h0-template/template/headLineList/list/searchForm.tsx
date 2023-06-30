
import React, { FC, useState } from 'react';
import intl from 'utils/intl';
import { ButtonColor } from 'choerodon-ui/pro/lib/button/interface';
import {
  Form,
  Row,
  Col,
  Button,
  DataSet,
  Select,
  Lov,
  TextField,
  DateTimePicker,
} from 'choerodon-ui/pro';

interface SearchFormProps {
  dataSet: DataSet;
}

const SearchFrom: FC<SearchFormProps> = ({ dataSet }) => {
  const [toggle, setToggle] = useState(true);

  const searchDs = dataSet.queryDataSet;

  const changeToggle = () => {
    setToggle(!toggle);
  };

  const handleSearch = async () => {
    dataSet.query();
  };
  const keyDownHandle = async e => {
    if (e.key === 'Enter') {
      await handleSearch();
    }
  };

  const handleReset = () => {
    dataSet.queryDataSet?.loadData([]);
  };

  const formColumns = [
    <TextField name="s1" />,
    <DateTimePicker name="s2" />,
    <Lov name="s3" />,
    <Select name="s4" />,
  ];

  return (
    <Row gutter={12}>
      <Col span={18}>
        <Form dataSet={searchDs} columns={3} onKeyDown={keyDownHandle}>
          {toggle ? formColumns.slice(0, 3) : formColumns}
        </Form>
      </Col>
      <Col span={6}>
        <Form columns={1}>
          <span>
            {formColumns.length > 3 && (
              <Button onClick={changeToggle}>
                {toggle
                  ? intl.get(`hzero.common.button.viewMore`).d('更多查询')
                  : intl.get(`hzero.common.button.collected`).d('收起查询')}
              </Button>
            )}
            <Button onClick={handleReset}>{intl.get(`hzero.common.button.reset`).d('重置')}</Button>
            <Button onClick={handleSearch} color={ButtonColor.primary}>
              {intl.get(`hzero.common.button.search`).d('查询')}
            </Button>
          </span>
        </Form>
      </Col>
    </Row>
  );
};

export default SearchFrom;