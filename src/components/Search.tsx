import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';

// Components
import {
  Header,
  Input,
  Segment,
  Table,
  Checkbox,
  Form,
  Loader,
} from 'semantic-ui-react';
import { PersonCard } from '@/components/Person/Card';

// Utils
import getGrade, { currentYear } from '@/utils/getGrade';

// Styles
import styles from './Search.module.less';

// Libs
import { provinces, type OIer } from '@/libs/OIerDb';

export const Search: React.FC = () => {
  const [searchParams, _setSearchParams] = useSearchParams();

  const setSearchParams = (params: { [key: string]: string }) => {
    const _params = new URLSearchParams(searchParams.toString());
    Object.keys(params).forEach((key) => {
      _params.set(key, params[key]);
    });
    _setSearchParams(_params.toString());
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

  const province = searchParams.get('province') || '';
  const setProvince = (province: string) => setSearchParams({ province });

  const grade = searchParams.get('grade') || '';
  const setGrade = (grade: string) => setSearchParams({ grade });

  const school = searchParams.get('school') || '';
  const setSchool = (school: string) => setSearchParams({ school });

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState(null);

  useEffect(() => {
    setResult(null);

    startTransition(() => {
      let result: OIer[] = [];
      if (!advanced) {
        result = OIerDb.oiers.filter(
          (oier) => oier.name === input || oier.initials === input
        );
      } else {
        result = OIerDb.oiers.filter((oier) => {
          let res = Boolean(input || province || grade || school);
          if (input) {
            res &&= oier.name === input || oier.initials === input;
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
          return res;
        });
      }

      setResult(result);
    });
  }, [input, province, grade, school, advanced]);

  return (
    <>
      <Header
        className={styles.header}
        block
        as="h4"
        content="??????"
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
            label="????????????"
            defaultChecked={advanced}
            onClick={(_, data) => setAdvanced(data.checked)}
          />
        </div>
        {!advanced ? (
          <Input
            fluid
            placeholder="???????????????????????????????????????..."
            loading={isPending}
            onChange={(_, { value }) => setInput(value)}
            spellCheck="false"
            defaultValue={input}
          />
        ) : (
          <Form onSubmit={() => false}>
            <Form.Group widths="equal">
              <Form.Input
                label="??????"
                placeholder="??????????????????????????????"
                spellCheck="false"
                onChange={(_, { value }) => setInput(value)}
                defaultValue={input}
              />
              <Form.Dropdown
                label="??????"
                placeholder="??????"
                search
                selection
                clearable
                options={provinces.map((province) => ({
                  key: province,
                  value: province,
                  text: province,
                }))}
                defaultValue={province}
                onChange={(_, { value }) => setProvince(value as string)}
              />
              <Form.Dropdown
                label="??????"
                placeholder="??????"
                search
                selection
                clearable
                options={OIerDb.enroll_middle_years
                  .map((year) => ({
                    key: year,
                    value: year,
                    text: getGrade(year, currentYear),
                  }))
                  .sort((a, b) => {
                    const t = ['???', '???', '???', '???', '???', '???'];

                    let keyA = a.key;
                    let keyB = b.key;

                    // ??????
                    if (a.text[0] === '???' && !a.text.includes('??????'))
                      keyA *= 4;
                    if (b.text[0] === '???' && !b.text.includes('??????'))
                      keyB *= 4;

                    // ??????
                    if (a.text[0] === '???') keyA *= 3;
                    if (b.text[0] === '???') keyB *= 3;

                    // ??????
                    if (t.includes(a.text[0])) keyA *= 2;
                    if (t.includes(b.text[0])) keyB *= 2;

                    return keyB - keyA;
                  })}
                defaultValue={grade}
                onChange={(_, { value }) => setGrade(value as string)}
              />
            </Form.Group>
            <Form.Input
              label="??????"
              placeholder="????????????"
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
                  <Table.HeaderCell>??????</Table.HeaderCell>
                  <Table.HeaderCell>??????</Table.HeaderCell>
                  <Table.HeaderCell>??????</Table.HeaderCell>
                  <Table.HeaderCell width={2}>??????</Table.HeaderCell>
                  <Table.HeaderCell width={2}>CCF ??????</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {result.map((oier) => (
                  <PersonCard key={oier.uid} oier={oier} />
                ))}
              </Table.Body>
            </Table>
          </div>
        ) : (
          <>
            {input || province || grade || school ? (
              <div style={{ paddingTop: '1rem' }}>???????????????</div>
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
