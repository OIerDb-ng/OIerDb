import { useEffect, useMemo, useState, useTransition } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Header,
  Input,
  Segment,
  Table,
  Checkbox,
  Form,
  Loader,
} from 'semantic-ui-react';
import { useLocalStorage } from 'usehooks-ts';
import PersonCard from '@/components/PersonCard';
import getGrade, { currentYear } from '@/utils/getGrade';
import compareGrades from '@/utils/compareGrades';
import {
  type OIer,
  genders,
  searchableGenderKeys,
  provincesWithId,
} from '@/libs/OIerDb';
import styles from './Search.module.less';

const Search: React.FC = () => {
  // Gender display
  const [displayGender] = useLocalStorage('display_gender', false);

  const [searchParams, _setSearchParams] = useSearchParams();

  const setSearchParams = (params: { [key: string]: string }) => {
    const _params = new URLSearchParams(searchParams.toString());
    Object.keys(params).forEach((key) => {
      _params.set(key, params[key]);
    });
    _setSearchParams(_params.toString(), {
      replace: true,
    });
  };

  const input = searchParams.get('query') || '';
  const setInput = (query: string) => setSearchParams({ query });

  const advanced = searchParams.get('advanced') === '1' || false;
  const setAdvanced = (advanced: boolean) =>
    setSearchParams({
      advanced: advanced ? '1' : '0',
      province: '',
      grade: '',
      school: '',
    });

  const provinces = useMemo(
    () =>
      Object.entries(provincesWithId).map(([id, province]) => ({
        key: id,
        value: province,
        text: `${province} (${id})`,
        content: province,
        label: { content: id, basic: true, size: 'mini' },
      })),
    []
  );

  const province = searchParams.get('province') || '';
  const setProvince = (province: string) => setSearchParams({ province });

  const grade = searchParams.get('grade') || '';
  const setGrade = (grade: string) => setSearchParams({ grade });

  const school = searchParams.get('school') || '';
  const setSchool = (school: string) => setSearchParams({ school });

  const gender = parseInt(searchParams.get('gender') || '0', 10) || 0;
  const setGender = (gender: number) =>
    setSearchParams({ gender: gender.toString() });

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState(null);

  useEffect(() => {
    setResult(null);

    startTransition(() => {
      let result: OIer[] = [];

      if (!advanced) {
        result = OIerDb.oiers.filter(
          (oier) =>
            oier.lowered_name === input ||
            oier.initials === input ||
            (() => {
              //match pinyin
              const pinyinBatch = Array.from(oier.lowered_name).map((char) => [
                ...OIerDb.pinyins.getFull(char),
                ...OIerDb.pinyins.getInitial(char),
              ]);
              if (pinyinBatch.some((p) => p.length === 0)) return false;
              let matched = [-1];
              for (const pinyins of pinyinBatch) {
                const newMached = [];
                for (const i of matched) {
                  for (const pinyin of pinyins) {
                    if (input.slice(i + 1).startsWith(pinyin)) {
                      newMached.push(i + pinyin.length);
                    }
                  }
                }
                matched = newMached;
              }
              return matched.some((i) => i == input.length - 1);
            })()
        );
      } else if (!input && !grade && !school) {
        result = [];
      } else {
        result = OIerDb.oiers.filter((oier) => {
          let res = Boolean(input || province || grade || school || gender);

          if (input) {
            res &&= oier.lowered_name === input || oier.initials === input;
          }
          if (province) {
            res &&= oier.provinces.includes(province);
          }
          if (grade) {
            res &&= oier.enroll_middle.toString() === grade;
          }
          if (school) {
            res &&= oier.records
              .map((record) => record.school.name)
              .includes(school);
          }
          if (gender) {
            res &&= oier.gender == gender;
          }

          return res;
        });
      }

      setResult(result);
    });
  }, [input, province, grade, school, advanced, gender]);

  return (
    <>
      <Header
        className={styles.header}
        block
        as="h4"
        content="搜索"
        attached="top"
        icon="search"
      />
      <Segment attached="bottom">
        <div
          style={{
            marginBottom: '1em',
            display: 'flex',
            flexDirection: 'row-reverse',
          }}
        >
          <Checkbox
            slider
            label="高级搜索"
            defaultChecked={advanced}
            onClick={(_, data) => setAdvanced(data.checked)}
          />
        </div>
        {!advanced ? (
          <Input
            fluid
            placeholder="键入学生姓名，拼音或其拼音首字母..."
            loading={isPending}
            onChange={(_, { value }) => setInput(value.toLowerCase())}
            spellCheck="false"
            defaultValue={input}
          />
        ) : (
          <Form onSubmit={() => false}>
            <Form.Group widths="equal">
              <Form.Input
                label="姓名"
                placeholder="姓名，姓名拼音或姓名拼音首字母"
                spellCheck="false"
                onChange={(_, { value }) => setInput(value.toLowerCase())}
                defaultValue={input}
              />
              <Form.Dropdown
                label="省份"
                placeholder="省份"
                search
                selection
                clearable
                options={provinces}
                defaultValue={province}
                onChange={(_, { value }) => setProvince(value as string)}
              />
              <Form.Dropdown
                label="年级"
                placeholder="年级"
                search
                selection
                clearable
                options={OIerDb.enroll_middle_years
                  .map((year) => ({
                    key: year,
                    value: year,
                    text: getGrade(year, currentYear),
                  }))
                  .sort(compareGrades)}
                defaultValue={grade}
                onChange={(_, { value }) => setGrade(value as string)}
              />
              {displayGender && (
                <Form.Dropdown
                  label="性别"
                  placeholder="性别"
                  selection
                  clearable
                  options={searchableGenderKeys.map((key) => ({
                    key: key,
                    value: key,
                    text: genders[key],
                  }))}
                  defaultValue={gender || null}
                  onChange={(_, { value }) => setGender(value as number)}
                />
              )}
            </Form.Group>
            <Form.Input
              label="学校"
              placeholder="学校全称"
              defaultValue={school}
              onChange={(_, { value }) => setSchool(value)}
            />
          </Form>
        )}
        {isPending ? (
          <Loader active inline="centered" style={{ marginTop: '1rem' }} />
        ) : result?.length ? (
          <div style={{ marginTop: '1.5rem' }}>
            <Table basic="very" unstackable>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell width={1}>#</Table.HeaderCell>
                  <Table.HeaderCell>姓名</Table.HeaderCell>
                  {displayGender && <Table.HeaderCell>性别</Table.HeaderCell>}
                  <Table.HeaderCell>省份</Table.HeaderCell>
                  <Table.HeaderCell>年级</Table.HeaderCell>
                  <Table.HeaderCell width={2}>评分</Table.HeaderCell>
                  <Table.HeaderCell width={2}>CCF 评级</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {result.map((oier) => (
                  <PersonCard key={`SEARCH-${oier.uid}`} oier={oier} />
                ))}
              </Table.Body>
            </Table>
          </div>
        ) : (
          <>
            {input || province || grade || school || gender ? (
              <div style={{ paddingTop: '1rem' }}>
                {gender || province ? (
                  gender ? (
                    '暂时不支持仅按照性别搜索选手。'
                  ) : (
                    <>
                      请访问「
                      <Link to="/oiers">选手</Link>」页面查询某省的所有选手。
                    </>
                  )
                ) : (
                  '未找到结果。'
                )}
              </div>
            ) : (
              <></>
            )}
          </>
        )}
      </Segment>
    </>
  );
};

export default Search;
