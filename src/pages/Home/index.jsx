import { Component } from 'react';

// Components
import {
    Loading,
    NotSupportIndexedDB,
    ErrorWhenLoadingOIerDb,
    FAQ,
} from '../../components/Home';
import Search from '../../components/Search';

// 是否支持 indexedDB
const notSupportIndexedDB = !globalThis || !globalThis.indexedDB;

class Home extends Component {
    constructor(props) {
        super(props);
        this.state = {
            loadedOIerDb: false,
            errorWhenLoadingOIerDb: false,
        };
    }

    async componentDidMount() {
        // 加载 OIerDb
        if (await OIerDb.init()) {
            this.setState({
                loadedOIerDb: true,
                errorWhenLoadingOIerDb: false,
            });
        } else {
            this.setState({
                loadedOIerDb: false,
                errorWhenLoadingOIerDb: true,
            });
        }
    }

    render() {
        let result = null;
        // 不支持 indexedDB
        if (notSupportIndexedDB) {
            return <NotSupportIndexedDB />;
        }

        if (!this.state.loadedOIerDb && this.state.errorWhenLoadingOIerDb) {
            // 加载失败时的提示信息
            result = <ErrorWhenLoadingOIerDb />;
        } else if (!this.state.loadedOIerDb) {
            // 加载中
            result = <Loading />;
        } else {
            // 搜索框
            result = <Search />;
        }

        return (
            <>
                {result}
                <FAQ />
            </>
        );
    }
}

export default Home;
