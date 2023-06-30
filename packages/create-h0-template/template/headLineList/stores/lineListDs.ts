import { DataSet } from 'choerodon-ui/pro';
import intl from 'utils/intl';
import { BASE_SERVER, API_HOST } from '@src/utils/constants';
import { getCurrentOrganizationId, getCurrentUserId } from 'utils/utils';
import { FieldType } from 'choerodon-ui/pro/lib/data-set/enum';
import { AxiosRequestConfig } from 'axios';

const modelPrompt = 'tarzan.子模块名称.功能名称';

const lineListDsFactory = () =>
    new DataSet({
        primaryKey: '主键',
        selection: false,
        autoQuery: false,
        dataKey: 'rows.content',
        totalKey: 'rows.totalElements',
        queryDataSet: new DataSet({
            fields: [],
        }),
        fields: [],
        transport: {
            read: (config: AxiosRequestConfig): AxiosRequestConfig => {
                return {
                    ...config,
                    url: `${API_HOST}${BASE_SERVER}/v1/${getCurrentOrganizationId()}/地址`,
                    transformResponse: value => {
                        let listData: any = {};
                        try {
                            listData = JSON.parse(value);
                        } catch (err) {
                            listData = {
                                message: err,
                            };
                        }
                        if (!listData.success) {
                            return {
                                ...listData,
                                failed: true,
                            };
                        }
                        return listData;
                    },
                };
            },
        },
    });

export default lineListDsFactory;