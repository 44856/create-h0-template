import React, { FC } from 'react';
import { Header, Content } from 'components/Page';
import { Table, DataSet, Button } from 'choerodon-ui/pro';
import { Button as PermissionButton } from 'components/Permission';
import formatterCollections from 'utils/intl/formatterCollections';
import intl from 'utils/intl';
import withProps from 'utils/withProps';
import { RouteComponentProps } from 'react-router';
import { ColumnProps } from 'choerodon-ui/pro/lib/table/Column';
import { TableQueryBarType } from 'choerodon-ui/pro/lib/table/enum';
import { ButtonColor } from 'choerodon-ui/pro/lib/button/enum';
import notification from 'hzero-front/src/utils/notification';
import axios from 'axios';
import listPageFactory from '../stores/listPageDs';
import SearchFrom from './searchForm';

interface TestPageProps extends RouteComponentProps {
  listDs: DataSet;
}

const modelPrompt = 'tarzan.子模块名称.功能名称';

const TestPageComponent: FC<TestPageProps> = ({ listDs, match: { path } }) => {
  const columns: ColumnProps[] = [
    {
      name: 'name',
    },
  ];

  const onHandleClick = async () => {
    const res: any = await axios.post('url', {});
    if (res && res.success) {
      notification.success({});
    }
  };

  return (
    // 替换产品类名
    <div className="hcmp-wrap">
      <Header title={intl.get(`${modelPrompt}.title.`).d('标题')}>
        <Button color={ButtonColor.primary} onClick={onHandleClick}>
          {intl.get(`${modelPrompt}.button.`).d('按钮名')}
        </Button>
        <PermissionButton
          type="c7n-pro"
          permissionList={[
            {
              code: `${path}.button.`,
              type: 'button',
              meaning: '标题-按钮名',
            },
          ]}
          icon="add"
        >
          {intl.get(`${modelPrompt}.button.`).d('按钮名')}
        </PermissionButton>
      </Header>
      <Content>
        <SearchFrom dataSet={listDs} />
        <Table
          dataSet={listDs}
          columns={columns}
          queryBar={TableQueryBarType.none}
          customizable
          customizedCode={`${modelPrompt}.column-group`}
        />
      </Content>
    </div>
  );
};

const TestPage = withProps(
  () => {
    const listDs = listPageFactory();
    return {
      listDs,
    };
  },
  { cacheState: true },
)(TestPageComponent);
export default formatterCollections({
  code: ['tarzan.子模块名称.common', 'tarzan.子模块名称.功能名称'],
})(TestPage);